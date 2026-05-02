# DF1 UI assets

Extracted from `/Users/BangZ/Downloads/Delta Force/Dfbase.pff` for matching the original menu progress and slider styling.

Relevant reverse-engineering notes:

- `DF.MNU` declares slider images:
  - `ImageBtnSlider = slider.pcx`
  - `ImageBtnSlider2 = vslider.pcx`
  - `ImageBtnHSlider = hslider.pcx`
  - `ImageBtnHSlider2 = hslider2.pcx`
  - `ImageBtnHSlider3 = hslider3.pcx`
- Volume sliders use a horizontal bar and thumb:
  - `ImageBtn216Bar = hsld_216.pcx`
  - `ImageBtnSlider = slider.pcx`
- Mission and keyboard scrollbars use vertical bars and thumbs:
  - `ImageVMissBar2 = vsld_243.pcx`
  - `ImageKbdBar = vsld_211.pcx`
  - `ImageBtnSlider2 = vslider.pcx`
- IDA/MCP shows `sub_422F90` allocates `{VU}BarRight` and expands `ImageLightBarRt` to an 84x480 buffer, so `BAR_*` assets are menu frame/light-bar material rather than the small slider itself.

Raw PCX copies are kept under `raw/`; PNG files are converted copies for direct frontend imports.
