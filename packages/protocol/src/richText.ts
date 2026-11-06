/**
 * The sixteen colours of the original backtick codes
 * (legacy/source/funeral_util.cpp:336-495). The client maps each name to a
 * palette value; the engine never emits raw colours or HTML.
 */
export type TextColor =
  | "blue" // `1
  | "green" // `2
  | "teal" // `3
  | "red" // `4
  | "purple" // `5  (numbers and stats)
  | "brown" // `6
  | "grey" // `7
  | "darkGrey" // `8
  | "lightBlue" // `9
  | "lightGreen" // `0
  | "cyan" // `!
  | "lightRed" // `@
  | "pink" // `#
  | "yellow" // `$ and `y  (body text)
  | "white" // `w  (speaker names)
  | "black"; // `^

export interface TextSpan {
  /** May contain "\n" for line breaks. */
  text: string;
  color?: TextColor;
  /** Relative size step from the original `fN code; 0 is normal. */
  size?: number;
  /** Set for links in announcements. Only http and https are allowed. */
  href?: string;
}

export type RichText = TextSpan[];
