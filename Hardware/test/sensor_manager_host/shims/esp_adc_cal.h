#pragma once
#include <cstdint>
constexpr int ADC_UNIT_1 = 1;
constexpr int ADC_ATTEN_DB_12 = 12;
constexpr int ADC_WIDTH_BIT_12 = 12;
constexpr int ESP_ADC_CAL_VAL_DEFAULT_VREF = 0;
struct esp_adc_cal_characteristics_t {};
int esp_adc_cal_characterize(int unit, int attenuation, int width,
                             uint32_t defaultVref, esp_adc_cal_characteristics_t* characteristics);
