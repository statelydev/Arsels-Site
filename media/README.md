# media/

Drop your footage and stills in here, then point each category at its files
in the `window.ARSEL` block at the top of `index.html`.

Each letter of ARSEL is one category. Hovering a letter previews it, clicking
it opens that category's gallery.

    {
      char: "A",
      name: "Commercial",          // shown in outline type above the letter
      works: [
        { type: "video", src: "media/a1.mp4", poster: "media/a1.jpg",
          title: "Afterglow", client: "Meridian", year: "2025" },
        { type: "photo", src: "media/a2.jpg",
          title: "Dry Season", client: "Meridian", year: "2024" }
      ]
    }

The first work in the list is what shows inside the letter on hover. To use a
different piece for that, add a `cover` next to `name`:

    cover: { type: "video", src: "media/a-reel.mp4" },

## Tips

- **Letter previews.** Keep these short (10-20 s) and under about 10 MB so the
  hover feels instant. They are muted and looped. The letters crop to their own
  shape, so pick shots with the subject near the centre of frame.
- **Posters matter.** Gallery tiles show a still until you hover them. Without
  a `poster`, the page seeks one second into the clip, which lands on black if
  your film fades up from black. Add a `poster` JPG for every video.
- **Formats.** H.264 MP4 for video, JPG or WebP around 1600 px on the long side
  for photos. Gallery tiles are cropped to 16:9.
- **Category names.** Short ones sit best above the letters. Anything much
  longer than "Documentary" will start to crowd the word.
