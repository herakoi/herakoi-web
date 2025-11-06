# Three-channel Herakoi Web App

Main methods:
```js
function rgbToHsv(r, g, b) { ... } // converts RGB int8 to [h,s,v] [360,100,100]
function hueToFrequency(hue,  minInput=0.0, maxInput=1.0, minOutput=200, maxOutput=700) {...} // linear maps hue to freq
function brightnessToVolume(value, minInput=0.0, maxInput=1.0, minOutput=0.1, maxOutput=1.0) { ... } // log_10 maps brightness/value to volume
function saturationToPan(saturation, minInput=0.0, maxInput=1.0, minOutput=-1.0, maxOutput=+1.0) { ... } // linear maps saturation to Pan
function playFrequency(freq, distance = -2, volume = 0.5) { ... } // Create the sound; it uses
    oscillator = audioCtx.createOscillator();   // h
    panner     = audioCtx.createStereoPanner(); // s
    gainNode   = audioCtx.createGain();         // v
// and then
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    panner.pan.setValueAtTime(distance, audioCtx.currentTime);
```