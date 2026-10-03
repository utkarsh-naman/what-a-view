# WhatsApp Chat Viewer

A local-only React/Vite viewer for WhatsApp exported chats.

## Features

- Drag & drop `.zip` or `.txt` WhatsApp exports.
- Reads ZIP exports in the browser; no upload/server required.
- Parses common Android and iOS WhatsApp text-export formats.
- Renders a WhatsApp-style conversation.
- Shows images, video, audio, and common document attachments when the exported media files are present.
- Image lightbox.
- Message search.
- Variable-height virtualization with `react-virtuoso`, so large chats do not require rendering every message into the DOM at once.
- Multiline messages preserve line breaks using `white-space: pre-wrap`.
- Local object URLs are used for media playback.

## Run

```bash
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

## Build

```bash
npm run build
npm run preview
```

## Notes

WhatsApp exports vary by locale and app version. The parser defaults ambiguous numeric dates to day/month/year and supports common Android/iOS timestamp layouts.

For best media support, drop the original WhatsApp export ZIP rather than only the TXT file.