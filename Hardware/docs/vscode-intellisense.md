# VS Code cannot find Arduino/ESP32 includes

`C/C++(1696)` is an IntelliSense diagnostic. The editor needs the same include
directories, ESP32 compiler and preprocessor definitions as PlatformIO's build.
It can flag the first include even when the missing file is a nested dependency
such as Arduino.h, stdint.h or a library header.

In this repository VS Code was opened at AquaSense, while platformio.ini lives
inside Hardware. The root had no C++ configuration, so the editor fell back to
its Windows configuration. The SDK/libraries were installed in Hardware/.pio-core
and Hardware/.pio/libdeps; ordinary Windows include discovery did not know them.
Both Microsoft C/C++ and PlatformIO extensions were already installed.

## Refresh configuration

From the repository root, run with the Python interpreter that has PlatformIO:

```powershell
& "$env:USERPROFILE/.platformio/penv/Scripts/python.exe" Hardware/scripts/configure_intellisense.py
```

The script uses PlatformIO to generate one compilation database per firmware
environment, plus its ESP32 include/compiler configuration. It writes ignored
`.vscode/c_cpp_properties.json` files at the AquaSense and Hardware roots so both
workspace layouts work. Existing root settings.json (including TypeScript settings)
is preserved. Frontend, Backend and firmware runtime behavior are unaffected.

Generated files contain machine-specific SDK paths and stay out of Git. Rerun
after moving the repository, changing dependencies/source filters, adding source
files or cleaning the .pio directories. The local .pio-core cache is selected
when present unless PLATFORMIO_CORE_DIR is explicitly configured.

If VS Code still shows old errors, use Ctrl+Shift+P:

1. `C/C++: Reset IntelliSense Database`.
2. `Developer: Reload Window` if necessary.

The C++ configuration should be `AquaSense ESP32 (PlatformIO)`. Do not replace
ESP32 headers with Windows headers or disable error squiggles to hide the issue.
If another custom root C++ configuration exists, the setup script stops instead
of overwriting it; merge the generated Hardware configuration into it explicitly.

Compilation databases use actual per-source compiler commands. Headers without
an associated translation unit fall back to the generated water-monitor settings,
whose dependencies include those needed by the three preserved targets. The
Arduino reference sketch remains excluded from firmware builds.

References: [PlatformIO compilation databases](https://docs.platformio.org/en/latest/integration/compile_commands.html)
and [VS Code C++ configuration](https://code.visualstudio.com/docs/cpp/customize-cpp-settings).
