/*
 * Smart Streetlight Control System Simulation (Arduino Uno)
 * Course: 25EE256 - Sensor and Instrumentation
 * Original Wokwi Project: https://wokwi.com/projects/476159903212574721
 */

const int LDR_PIN = A0;      // LDR Analog Input
const int PIR_PIN = 2;       // PIR Motion Digital Input
const int LED_PIN = 9;       // PWM Output to Streetlight LED

// Threshold setting for simulated LDR module
// In Wokwi photoresistor sensor: High Lux gives low A0 value, Darkness gives high A0 value
const int LUX_THRESHOLD = 500; 

// Brightness levels (0-255 PWM)
const int BRIGHTNESS_OFF  = 0;    // 0% - Day mode
const int BRIGHTNESS_DIM  = 50;   // ~20% - Night idle mode
const int BRIGHTNESS_FULL = 255;  // 100% - Motion triggered mode

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("================================================");
  Serial.println("  Smart Streetlight Simulation Initialized");
  Serial.println("================================================");
}

void loop() {
  int ldrRaw = analogRead(LDR_PIN);
  int motion = digitalRead(PIR_PIN);

  // Determine ambient light status
  bool isDark = (ldrRaw < LUX_THRESHOLD);

  Serial.print("Sensor A0: ");
  Serial.print(ldrRaw);
  Serial.print(" | Light: ");
  Serial.print(isDark ? "DARK (Night) " : "BRIGHT (Day) ");
  Serial.print(" | Motion: ");
  Serial.print(motion ? "DETECTED " : "NONE     ");
  Serial.print(" -> State: ");

  if (!isDark) {
    // 1. Daytime: Streetlight is OFF
    analogWrite(LED_PIN, BRIGHTNESS_OFF);
    Serial.println("OFF (0%)");
  } 
  else {
    // 2. Nighttime: Check occupancy
    if (motion == HIGH) {
      // Pedestrian or vehicle detected -> Full illumination
      analogWrite(LED_PIN, BRIGHTNESS_FULL);
      Serial.println("ACTIVE (100% Full Brightness)");
      delay(3000); // Keep on for 3 seconds in simulation
    } else {
      // Empty road -> Energy-saving standby dim mode
      analogWrite(LED_PIN, BRIGHTNESS_DIM);
      Serial.println("STANDBY (20% Dim)");
    }
  }

  delay(300);
}
