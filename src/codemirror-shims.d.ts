declare module "@codemirror/language" {
  import type { EditorState } from "@codemirror/state";
  import type { SyntaxNode } from "@lezer/common";

  interface SyntaxNodeRef {
    type: { name: string };
    from: number;
    to: number;
    node: SyntaxNode;
  }

  interface SyntaxTree {
    iterate(options: {
      from?: number;
      to?: number;
      enter: (node: SyntaxNodeRef) => void;
    }): void;
    resolveInner(pos: number, side?: number): SyntaxNode;
  }

  export function syntaxTree(state: EditorState): SyntaxTree;

  export function ensureSyntaxTree(
    state: EditorState,
    upto: number,
    timeout?: number,
  ): number;
}

declare module "@lezer/common" {
  export class SyntaxNode {
    from: number;
    to: number;
    type: { name: string };
    parent: SyntaxNode | null;
    firstChild: SyntaxNode | null;
    nextSibling: SyntaxNode | null;
    getChild(name: string): SyntaxNode | null;
  }
}
