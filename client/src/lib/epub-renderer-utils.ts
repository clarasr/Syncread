export const FONT_FAMILIES: Record<string, string> = {
  georgia: "Georgia, serif",
  palatino: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
  charter: 'Charter, "Bitstream Charter", serif',
  "new-york": '-apple-system-ui-serif, "New York", "Georgia", serif',
  "san-francisco": '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  iowan: '"Iowan Old Style", "Palatino Linotype", serif',
};

export interface RenderOptions {
  html: string;
  css?: string;
  font?: string;
  boldText?: boolean;
  lineSpacing?: number;
  characterSpacing?: number;
  wordSpacing?: number;
  paginated?: boolean;
}

export function generateEpubDocument(options: RenderOptions): string {
  const {
    html,
    css = "",
    font = "georgia",
    boldText = false,
    lineSpacing = 1.65,
    characterSpacing = 0,
    wordSpacing = 0,
    paginated = false,
  } = options;

  const computedStyle = getComputedStyle(document.documentElement);
  const backgroundColor = computedStyle.getPropertyValue('--reading-background');
  const foregroundColor = computedStyle.getPropertyValue('--reading-foreground');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 100%;
            height: 100%;
            overflow: ${paginated ? 'hidden' : 'auto'};
            background-color: hsl(${backgroundColor});
            color: hsl(${foregroundColor});
          }
          
          body {
            font-family: ${FONT_FAMILIES[font] || FONT_FAMILIES.georgia};
            font-weight: ${boldText ? 600 : 400};
            line-height: ${lineSpacing};
            letter-spacing: ${characterSpacing}em;
            word-spacing: ${wordSpacing}em;
            font-size: 18px;
            padding: 3rem 2rem;
            max-width: 65ch;
            margin: 0 auto;
            ${paginated ? 'column-width: 100%; column-gap: 0; column-fill: auto;' : ''}
          }
          
          /* Preserve EPUB styles */
          ${css}
          
          /* Ensure images are responsive */
          img {
            max-width: 100%;
            height: auto;
          }
          
          /* Style common elements */
          h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            line-height: 1.3;
            ${paginated ? 'break-after: avoid;' : ''}
          }
          
          p {
            margin-bottom: 1em;
          }
          
          a {
            color: hsl(${foregroundColor});
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;
}
