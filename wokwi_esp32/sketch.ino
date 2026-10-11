/*
 * Smart Streetlight IoT Control System with ThingSpeak Integration
 * Hardware: ESP32 + LDR + PIR Sensor + LED (Wokwi Simulation)
 * Course: 25EE256 - Sensor and Instrumentation
 */

#include <WiFi.h>
#include <HTTPClient.h>

// WiFi Configuration (Wokwi Free Virtual AP)
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// ThingSpeak Configuration
// Replace with your ThingSpeak Write API Key from your channel:
const char* serverName = "http://api.thingspeak.com/update";
String apiKey = "YOUR_THINGSPEAK_WRITE_API_KEY"; 

// Pin Definitions
const int LDR_PIN = 34;      // ESP32 Analog Input (ADC1)
const int PIR_PIN = 27;      // PIR Motion Digital Input
const int LED_PIN = 18;      // PWM Output to Streetlight LED

// Threshold setting for LDR module (0 - 4095 on ESP32 ADC)
// In Wokwi photoresistor: High Lux gives low ADC value, Darkness gives high ADC value
const int LUX_THRESHOLD = 2000; 

// Brightness levels (0-255 PWM)
const int BRIGHTNESS_OFF  = 0;    // 0% - Day mode
const int BRIGHTNESS_DIM  = 50;   // ~20% - Night idle standby mode
const int BRIGHTNESS_FULL = 255;  // 100% - Motion triggered active mode

// Telemetry Timer (ThingSpeak free tier rate limit is 15 seconds)
unsigned long lastTime = 0;
const unsigned long timerDelay = 15000; // 15 seconds

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  Serial.println("\n================================================");
  Serial.println("  Smart Streetlight IoT Simulation (ESP32)");
  Serial.println("  Connecting to WiFi and ThingSpeak...");
  Serial.println("================================================");

  // Connect to Wokwi WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  int ldrRaw = analogRead(LDR_PIN);
  int motion = digitalRead(PIR_PIN);

  // In Wokwi ESP32 ADC is 12-bit (0-4095) or Arduino normalized
  // Scale down to 0-1023 for compatibility with Uno dashboard metrics
  int ldrScaled = map(ldrRaw, 0, 4095, 0, 1023);
  bool isDark = (ldrRaw > LUX_THRESHOLD || ldrScaled < 500);

  int currentPwm = BRIGHTNESS_OFF;
  float powerWatts = 0.0;
  int modeIndex = 0; // 0: Day OFF, 1: Night Standby, 2: Motion Active

  if (!isDark) {
    // 1. Daytime: Streetlight is OFF
    currentPwm = BRIGHTNESS_OFF;
    powerWatts = 0.0;
    modeIndex = 0;
    analogWrite(LED_PIN, BRIGHTNESS_OFF);
  } 
  else {
    // 2. Nighttime: Check occupancy
    if (motion == HIGH) {
      // Pedestrian or vehicle detected -> Full 100% illumination
      currentPwm = BRIGHTNESS_FULL;
      powerWatts = 100.0;
      modeIndex = 2;
      analogWrite(LED_PIN, BRIGHTNESS_FULL);
    } else {
      // Empty road -> Energy-saving standby dim mode (20%)
      currentPwm = BRIGHTNESS_DIM;
      powerWatts = 20.0;
      modeIndex = 1;
      analogWrite(LED_PIN, BRIGHTNESS_DIM);
    }
  }

  // Periodic ThingSpeak Cloud Telemetry Upload
  if ((millis() - lastTime) >= timerDelay) {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;

      // Construct ThingSpeak URL Query
      // field1: LDR Value, field2: PIR Motion, field3: Brightness PWM, field4: Power, field5: Mode
      String url = String(serverName) + "?api_key=" + apiKey +
                   "&field1=" + String(ldrScaled) +
                   "&field2=" + String(motion) +
                   "&field3=" + String(currentPwm) +
                   "&field4=" + String(powerWatts) +
                   "&field5=" + String(modeIndex);

      Serial.println("\n[ThingSpeak] Sending HTTP GET update...");
      Serial.println(url);

      http.begin(url);
      int httpResponseCode = http.GET();

      if (httpResponseCode > 0) {
        String payload = http.getString();
        Serial.print("[ThingSpeak] Response Code: ");
        Serial.print(httpResponseCode);
        Serial.print(" | Entry ID: ");
        Serial.println(payload);
      } else {
        Serial.print("[ThingSpeak] Error on sending POST: ");
        Serial.println(httpResponseCode);
      }
      http.end();
    } else {
      Serial.println("[WiFi] Disconnected from WiFi");
    }
    lastTime = millis();
  }

  // Serial status monitor
  Serial.print("LDR: ");
  Serial.print(ldrScaled);
  Serial.print(" | Motion: ");
  Serial.print(motion ? "DETECTED " : "CLEAR    ");
  Serial.print(" | Lamp PWM: ");
  Serial.print(currentPwm);
  Serial.print(" | Power: ");
  Serial.print(powerWatts);
  Serial.println(" W");

  delay(500);
}
