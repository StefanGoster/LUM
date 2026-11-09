# Layer workflow

LUM keeps composition editable: each object has its own position, size, rotation, opacity and optional mask. Clipboard import, stabilized drawing, scoped ChatGPT briefs, raster inspection and prepared-layer import work now. ChatGPT can orchestrate generative preparation through available conversation image tools. An in-editor automatic **Dissect** button, semantic selection masks and an autonomous inference service remain proposed next steps; no paid inference engine is active.

## Chat-first command (v2)

**Dissect** alone returns named image outputs in the current chat. **Dissect into LUM** adds optional progressive saving to the editor. The same independent workflow supports HD / Remaster, Clean Noise and Reimagine. A clear command skips the menu; an ambiguous creative artwork submission gets one short observation and relevant choices. Error screenshots and identification questions are not editing triggers.

1. Inspect the source and identify meaningful objects, stack order and placement. Keep the original unchanged.
2. Prepare one transparent candidate with the chat's native image tool, referencing the original. Generation is separate from this backend.
3. Show that output immediately and record its actual file reference. Continue one object at a time.
4. Only if LUM saving was selected, use `lum_import_chat_file` with a valid platform-provided file object. No image bytes travel through textual tool output. If unavailable, preserve chat results and use ordinary file upload/paste; never fall back to large base64.
5. Read the destination project, retain the original as a locked hidden layer, and import each object independently with a one-object bundle and the latest revision. Use stable layer IDs. On uncertainty, read before retrying and skip already saved IDs.
6. Save compact metadata using `lum_save_image_checkpoint`; resume with `lum_get_image_checkpoint`. Distinguish planned, generated, saved and blocked. Checkpoints do not themselves store images.
7. Verify actual saved layers before claiming LUM completion. A transfer failure never restarts generation or erases the completed chat outputs.

Generative isolation/reconstruction can change details and invent hidden areas. It is not exact pixel extraction or recovery of original Photoshop layers. HD and cleanup are native image-editing directions, not an installed deterministic upscale/denoise engine. Preserve original lettering and texture, and disclose uncertainty.

The reusable chat source lives in `integrations/chatgpt/image-lab`. Independent logic and the menu live in `modules/image-lab`. They share a repository with LUM without requiring its document storage for ordinary chat image work.

## Start with the source

Copy an image and press Ctrl+V / ⌘V over the workspace, or use Paste image or file import. Supplied transparency is retained. An imported flat image is initially one layer. Keep that source as an unchanged, locked backup while preparing separate objects.

The current `lum_inspect_artwork` tool returns actual uploaded image pixels to ChatGPT, together with the layer's geometry and context. It supports PNG, JPEG and WebP up to 8 MB, reads private LUM assets only, and does not apply the layer's display mask, transform or color treatment. Inspection can inform a proposed object list; it does not create pixel masks or recover original Photoshop layers.

## Extract and Rebuild have different promises

| Proposed mode | What it should produce | What remains uncertain |
| --- | --- | --- |
| **Extract** | Original visible pixels inside a reviewed selection, with transparency outside it | Occluded parts remain missing. Fine engraving, hair, distress and overlapping objects need edge review. |
| **Rebuild** | A separate reconstructed object, including generated areas needed after moving it | Hidden pixels never existed in the flat source. Generated anatomy, architecture, markings and lettering require review. |

Neither mode can guarantee recovery of the original layered file. A future Dissect flow should propose named objects, let the user correct masks, preview their recomposition against the source, then import the approved layers. Reconstructed content should be labeled. Keep extraction and reconstruction separate so an exact source detail is never silently repainted.

## Example: GOSTLUM composition

This is a proposed semantic plan for the supplied statue, church and instrument design, not a claim that those layers have already been extracted:

| Object | Treatment |
| --- | --- |
| Classical statue head | Preserve the visible face and hair; any areas hidden by foreground objects need explicit reconstruction if exposed. |
| Church | Separate the visible architecture. Use a verified reference before changing historically meaningful details; the pictured building's identity is not established here. |
| Curved measuring instrument | Keep the curved scale separate from the globe. Preserve source markings unless a verified replacement is supplied. |
| Armillary globe | Isolate the rings and stand, reviewing holes and overlaps so transparency does not erase thin lines. |
| GOSTLUM wordmark | Preserve the original lettering as a transparent raster until an exact vector source or approved native-text replacement is available. OCR alone cannot recover its font, outlines or distress. |
| Shared surface texture | Split only where useful. Cracks and grain may belong to the head or an object's surface; they are not automatically an independent overlay. |

Determine stack order from the actual overlaps. Review boundaries against both light and dark backgrounds to catch halos and missing details. The locked source is a comparison reference, not an additional visible layer in the final recomposition.

## Reimagine one object

The working **Reimagine in ChatGPT** button saves the project and copies a brief scoped to the selected layer. Paste it into the conversation with LUM connected. It names the target, preserves its placement and mask unless requested otherwise, and asks for a separate candidate while keeping the source intact. It does not invoke an image model from the editor.

When an image-generation tool is available in that conversation, prepare only the replacement object using the surrounding composition as context. Preserve other layers through the editor's composition operations; prompting a model to redraw the whole design cannot guarantee unchanged pixels. Import the candidate separately, check alignment and edges, then review it before replacing or hiding the original. Read the latest project revision before accepting the result.

The existing bridge is:

1. Read the saved project and inspect the relevant source image.
2. Plan the target and use `lum_prepare_render` or the copied brief to state constraints.
3. Prepare the artwork through a separately available tool or manual process.
4. Upload the prepared assets and use `lum_import_layer_bundle` to add aligned objects together.
5. Review candidates in LUM; preserve originals and resolve revision conflicts before further edits.

Bundle import validates every layer before a single save, accepts 1–50 new IDs in back-to-front order, and cannot replace existing IDs. It does not automatically hide the flat source, generate artwork or split an image. Transparent full-artboard assets can share the same coordinates; cropped assets need explicit placement and dimensions.

## Generate as layers from the beginning

Start with a named object plan, artboard, palette, stack order and placement. Generate individual transparent assets with consistent scale, lighting and perspective. Add exact text as editable text or supplied vector artwork. Import the prepared objects together, then refine the composition in LUM. A flattened generation followed by automatic splitting is a less reliable way to obtain exact independent objects.

The four current brushes—Clean ink, Round marker, Chisel marker and Dry spray—produce native editable paths with adjustable stabilization. Compatible pens supply real pressure; mouse ink approximates variation from movement. These are useful for lettering and sketching structure references. They do not recognize handwriting, convert strokes to fonts or automatically reimagine drawn text.

## Engine choice still pending

[Qwen-Image-Layered](https://github.com/QwenLM/Qwen-Image-Layered), with its [official model card](https://huggingface.co/Qwen/Qwen-Image-Layered), is a candidate for image-to-RGBA-layer decomposition. Its released workflow does not guarantee that prompts can specify the semantic content of each output layer. Generated outputs need a proposed-name and review step, and layer-first creation should not assume direct text-to-layer generation is solved.

[SAM 2](https://github.com/facebookresearch/sam2) is a different candidate for interactive point/box-guided extraction masks. It selects visible content; it does not reconstruct what is hidden. Neither system is installed as LUM's inference engine.

A hosted GPU service or a separate local GPU process would need an explicit integration. The current Cloudflare application and MCP connection do not supply that compute. Future jobs should record the source revision, store candidates separately, expose actual progress and errors, and avoid applying late results over newer edits. Hosting, operating cost and source-image handling remain choices to make before activating an engine.
