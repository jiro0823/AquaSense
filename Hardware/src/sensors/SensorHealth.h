#pragma once
#include <math.h>
#include <stdint.h>
#include "config/DeviceConfig.h"

namespace SensorHealth {
enum class State { VALID, INVALID, SENSOR_ERROR, MISSING, STALE, UNSTABLE, SATURATED, POSSIBLY_STUCK };
enum class Stability { COLLECTING, STABLE, UNSTABLE };
enum class Kind { Temperature, Ph, Turbidity, Orp };
constexpr uint8_t WINDOW = 20, MIN_SAMPLES = 6, RAIL_SAMPLES = 3;
constexpr uint32_t STUCK_MS = 600000;
inline const char* name(State s) { const char* names[]={"VALID","INVALID","SENSOR_ERROR","MISSING","STALE","UNSTABLE","SATURATED","POSSIBLY_STUCK"}; return names[int(s)]; }
inline const char* name(Stability s) { return s==Stability::STABLE?"STABLE":s==Stability::UNSTABLE?"UNSTABLE":"COLLECTING"; }
struct Diagnostic {
    float value=NAN, rawAdc=NAN, voltage=NAN;
    int adcMinimum=-1, adcMaximum=-1, adcLast=-1;
    uint8_t clippedSamples=0;
    State health=State::MISSING;
    Stability stability=Stability::COLLECTING;
    const char* reason="No sensor reading yet";
    uint32_t sampledAtMs=0, stuckDurationMs=0;
    uint8_t count=0;
    float minimum=NAN, maximum=NAN, average=NAN, range=NAN, standardDeviation=NAN;
    bool valid=false, responding=false, ready=false;
};
inline void fail(Diagnostic& d, State s, const char* reason) { d.health=s; d.reason=reason; d.valid=false; d.ready=false; }
inline Diagnostic fresh(Diagnostic d,uint32_t now) {
    if (d.health!=State::MISSING && uint32_t(now-d.sampledAtMs)>DeviceConfig::TELEMETRY_MAX_AGE_MS) fail(d,State::STALE,"No recent sensor reading received");
    return d;
}
class Validator {
    float samples[WINDOW]={}, anchor=NAN;
    uint8_t count=0, next=0, rails=0;
    int side=0;
    uint32_t unchangedSince=0, lastAt=0;
    bool seen=false;
public:
    Diagnostic evaluate(Kind kind,float value,float adc,float voltage,uint32_t at,bool responded=true,bool clippedBurst=false) {
        Diagnostic d; d.value=value; d.rawAdc=adc; d.voltage=voltage; d.sampledAtMs=at; d.responding=responded;
        d.health=State::VALID; d.reason=""; d.valid=true;
        if (seen && uint32_t(at-lastAt)>DeviceConfig::TELEMETRY_MAX_AGE_MS) { count=next=rails=0; anchor=NAN; }
        seen=true; lastAt=at;
        if (!responded || (kind==Kind::Temperature && value==-127)) fail(d,State::SENSOR_ERROR,"DS18B20 disconnected/error reading detected");
        else if (!isfinite(value)) fail(d,State::INVALID,"Non-finite or failed sensor read");
        else if ((kind==Kind::Temperature && (value < -55 || value > 125)) ||
                 (kind==Kind::Ph && (value < 0 || value > 14)) ||
                 (kind==Kind::Turbidity && (value < 0 || value > 4095)) ||
                 (kind==Kind::Orp && (value < -1980 || value > 1320))) fail(d,State::INVALID,"Outside physical or existing conversion capability");
        if (kind!=Kind::Temperature) {
            if (!isfinite(adc) || adc<0 || adc>4095 || !isfinite(voltage) || voltage<0 || voltage>3.3f) fail(d,State::INVALID,"Invalid ADC or input voltage");
            int edge=adc<=8?-1:adc>=4087?1:clippedBurst?2:0;
            rails=edge && edge==side ? (rails<255?rails+1:255) : edge?1:0; side=edge;
            if (rails>=RAIL_SAMPLES) fail(d,State::SATURATED,edge==2?"ADC repeatedly clipping within sampling bursts":edge<0?"ADC repeatedly near minimum range":"ADC repeatedly near maximum range");
        }
        if (d.valid) {
            samples[next]=value; next=(next+1)%WINDOW; if(count<WINDOW) ++count;
            const float signal=isfinite(adc)?adc:value;
            if (!isfinite(anchor) || fabsf(signal-anchor)>(isfinite(adc)?1.0f:0.001f)) { anchor=signal; unchangedSince=at; }
            d.stuckDurationMs=uint32_t(at-unchangedSince);
            d.minimum=d.maximum=samples[0]; d.average=0;
            for(uint8_t i=0;i<count;++i) { d.minimum=fminf(d.minimum,samples[i]); d.maximum=fmaxf(d.maximum,samples[i]); d.average+=samples[i]; }
            d.average/=count; d.range=d.maximum-d.minimum; d.count=count; d.standardDeviation=0;
            for(uint8_t i=0;i<count;++i) d.standardDeviation+=(samples[i]-d.average)*(samples[i]-d.average);
            d.standardDeviation=sqrtf(d.standardDeviation/count);
            const float limits[]={1.0f,0.3f,150.0f,50.0f};
            if(count>=MIN_SAMPLES) d.stability=d.range>limits[int(kind)]?Stability::UNSTABLE:Stability::STABLE;
            if(d.stability==Stability::UNSTABLE) fail(d,State::UNSTABLE,"Large recent variation; inspect signal and water conditions");
            else if(d.stuckDurationMs>=STUCK_MS) fail(d,State::POSSIBLY_STUCK,"Nearly unchanged for 10 minutes; stable water is also possible");
        } else { count=next=0; anchor=NAN; }
        d.ready=d.valid && d.stability==Stability::STABLE;
        return d;
    }
};
struct Speciation { bool available=false; float pKa=NAN, fraction=NAN, percent=NAN; };
inline Speciation ammonia(Diagnostic temperature,Diagnostic ph,uint32_t now) {
    Speciation s;
    temperature=fresh(temperature,now); ph=fresh(ph,now);
    if (!temperature.valid || !ph.valid || temperature.value<0 || temperature.value>50) return s;
    s.pKa=0.09018f+2729.92f/(273.2f+temperature.value);
    s.fraction=1.0f/(1.0f+powf(10.0f,s.pKa-ph.value)); s.percent=s.fraction*100; s.available=true;
    return s;
}
}
