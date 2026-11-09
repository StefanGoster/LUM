# Optional LUM bridge

Discover connected LUM tools. Use `lum_import_chat_file` for actual ChatGPT file objects (`file_id`, `download_url`, optional `mime_type`, `file_name`) when available. Use platform-provided values only. This uploads bytes server-side and returns a small asset reference. Never call the legacy base64 upload for large raster files, and never manually transcribe image bytes.

If file-reference import is unavailable or rejects the host, keep the generated result in chat and offer ordinary LUM file upload/paste. Do not downgrade to base64, probe credentials, weaken URL validation, or regenerate. An expired signed URL needs a fresh authorized reference; never persist its secret query string in notes.

Create a new project unless a destination was selected. Preserve original as a locked hidden image source when its actual asset is available. Read the latest project before edits; respect locks and expected_revision. Import each completed object immediately with `lum_import_layer_bundle` (a one-element bundle is valid). Use deterministic object/layer IDs within a job. On an uncertain write or revision conflict, read the saved project before retrying and skip IDs already present. Do not silently overwrite or duplicate layers. Preserve artboard coordinates and alpha; no blind stretching.

Use `lum_save_image_checkpoint` for small metadata only, if available, and carry its returned checkpoint ID and revision. States must distinguish planned, generated, saved, blocked. Mark generated only with an actual output reference, saved only with verified asset/layer references. On resume, read `lum_get_image_checkpoint`; missing/expired file references are not durable image storage. Keep generated image saving separate from checkpoint saving.

After import, read back the project and report actual saved layers and anything blocked. No transfer success means no claim of LUM completion.
