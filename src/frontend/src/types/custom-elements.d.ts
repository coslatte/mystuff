import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "now-playing-el": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}