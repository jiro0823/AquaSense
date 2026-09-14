// Isolated executable test firmware: no Wi-Fi, MQTT, sensors or actuators started.
#include <Arduino.h>
#include "sensors/SensorHealth.h"
using namespace SensorHealth;
unsigned passed=0,failed=0;
void expect(const char* test,const char* input,const char* expected,const char* actual,bool ok) {
    Serial.printf("Test: %s\nInput: %s\nExpected: %s\nActual: %s\n%s\n",test,input,expected,actual,ok?"PASS":"FAIL");
    ok?++passed:++failed;
}
void setup() {
    Serial.begin(115200); delay(1500);
    Validator t,p,a,noisy;
    auto temp=t.evaluate(Kind::Temperature,25,NAN,NAN,1000);
    auto ph=p.evaluate(Kind::Ph,8,3000,2.4,1000);
    expect("Temperature","25 C","VALID",name(temp.health),temp.valid);
    auto error=t.evaluate(Kind::Temperature,-127,NAN,NAN,2000);
    expect("DS18B20 disconnect","-127 C","SENSOR_ERROR",name(error.health),error.health==State::SENSOR_ERROR);
    auto unsafe=p.evaluate(Kind::Ph,9.5,3000,2.4,2000);
    expect("Unsafe but valid pH","9.5","VALID",name(unsafe.health),unsafe.valid);
    auto invalid=p.evaluate(Kind::Ph,15,3000,2.4,3000);
    expect("Impossible pH","15","INVALID",name(invalid.health),invalid.health==State::INVALID);
    auto nan=p.evaluate(Kind::Ph,NAN,3000,2.4,4000);
    expect("NaN","NaN","INVALID",name(nan.health),!nan.valid);
    auto stale=fresh(temp,20000);
    expect("Stale","19 seconds","STALE",name(stale.health),stale.health==State::STALE);
    Diagnostic rail;
    for(int i=0;i<3;++i) rail=a.evaluate(Kind::Turbidity,4095,4095,3.3,1000+i*5000);
    expect("Clipping","3 consecutive rails","SATURATED",name(rail.health),rail.health==State::SATURATED);
    Diagnostic stable,noise;
    for(int i=0;i<20;++i) { stable=p.evaluate(Kind::Ph,8,3000,2.4,5000+i*5000); noise=noisy.evaluate(Kind::Ph,i%2?7:9,3000,2.4,5000+i*5000); }
    expect("Stable window","20 samples","STABLE",name(stable.stability),stable.stability==Stability::STABLE);
    expect("Noisy window","7/9 alternating","UNSTABLE",name(noise.health),noise.health==State::UNSTABLE);
    auto nh3=ammonia(temp,ph,1000);
    char actual[80];snprintf(actual,sizeof(actual),"pKa %.5f; fraction %.6f; percent %.4f",nh3.pKa,nh3.fraction,nh3.percent);
    expect("Emerson reference","25 C; pH 8","9.24484; 0.053842; 5.3842%",actual,nh3.available&&fabsf(nh3.fraction-0.053842f)<0.00001f);
    expect("Error blocks ammonia","-127 C; pH 8","UNAVAILABLE",ammonia(error,ph,2000).available?"AVAILABLE":"UNAVAILABLE",!ammonia(error,ph,2000).available);
    expect("Stale blocks ammonia","age 19 seconds","UNAVAILABLE",ammonia(temp,ph,20000).available?"AVAILABLE":"UNAVAILABLE",!ammonia(temp,ph,20000).available);
    Serial.printf("Tests: %u PASS / %u FAIL\n",passed,failed);
    Serial.println("TEST DATA ONLY. No physical sensor observation or calibration performed.");
}
void loop() { delay(1000); }
