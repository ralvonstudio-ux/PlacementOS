/**
 * The AI extraction/synthesis prompts ask for plain option text, but the model frequently answers
 * with its own "a. "/"b) "/"(c) " label already baked into the string. The paper/worksheet
 * renderer always prepends its own (a)/(b)/… label when printing an MCQ's options, so unstripped
 * input doubles up on the printed paper — "(a) a. England" instead of "(a) England".
 */
const OPTION_LABEL_PATTERN = /^\s*(?:\(([a-dA-D])\)|([a-dA-D])[.):])\s+/;

export function stripOptionLabel(option: string): string {
  return option.replace(OPTION_LABEL_PATTERN, '').trim();
}

export function normalizeOptions(options?: string[] | null): string[] | undefined {
  if (!Array.isArray(options)) return undefined;
  return options.map(stripOptionLabel);
}
