import { createCn, validators } from "cn/config";

/**
 * Class merging that knows the custom scales from src/styles/tokens.css. Without this,
 * `text-15` would count as a text color and override `text-ink`, and `rounded-12`
 * would not replace `rounded-lg`. Add new named sizes here when they appear in the tokens.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: [
        validators.isNumber,
        ...["h1", "h2", "lead", "label", "problem", "num", "step", "benefit", "memo"].flatMap(
          (name) => [name, `${name}-lg`],
        ),
      ],
      radius: [validators.isNumber],
      shadow: ["card", "card-lg"],
      container: ["page", "page-md", "lead", "h2", "step"],
    },
  },
});
