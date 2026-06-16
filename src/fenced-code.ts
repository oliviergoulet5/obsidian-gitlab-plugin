/* eslint-disable import/no-extraneous-dependencies -- CodeMirror modules are provided by Obsidian at runtime */
import { EditorView } from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";
import { syntaxTree } from "@codemirror/language";
import { MR_DISCUSS_CODE_BLOCK } from "./discuss-block-processor";

const FENCED_CODE_NODE_NAMES = new Set(["FencedCode", "CodeBlock"]);

export type ParsedFencedCode = {
  from: number;
  to: number;
  language: string;
  content: string;
};

function readFencedCodeInfo(
  view: EditorView,
  fencedNode: SyntaxNode,
): { language: string; content: string } {
  let language = "";
  let content = "";

  for (let child = fencedNode.firstChild; child; child = child.nextSibling) {
    const name = child.type.name;
    if (name === "CodeInfo") {
      language = view.state.sliceDoc(child.from, child.to).trim();
    } else if (name === "CodeText") {
      content = view.state.sliceDoc(child.from, child.to);
    }
  }

  if (!language) {
    const firstLine = view.state.doc.lineAt(fencedNode.from);
    const infoMatch = firstLine.text.match(/^```(\S*)/);
    language = infoMatch?.[1]?.trim() ?? "";
  }

  if (!content) {
    const text = view.state.sliceDoc(fencedNode.from, fencedNode.to);
    content = text.replace(/^```[^\n]*\n?/, "").replace(/\n?```[\s\S]*$/, "");
  }

  return { language, content };
}

export function parseFirstNonEmptyLine(content: string): string {
  return (
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  );
}

export function collectFencedCodeBlocks(
  view: EditorView,
  from: number,
  to: number,
): ParsedFencedCode[] {
  const blocks: ParsedFencedCode[] = [];

  syntaxTree(view.state).iterate({
    from,
    to,
    enter(node) {
      if (!FENCED_CODE_NODE_NAMES.has(node.type.name)) {
        return;
      }

      const { language, content } = readFencedCodeInfo(view, node.node);
      blocks.push({
        from: node.from,
        to: node.to,
        language,
        content,
      });
    },
  });

  return blocks;
}

export function isInsideFencedCode(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  let node: SyntaxNode | null = tree.resolveInner(pos, 1);

  for (; node; node = node.parent) {
    const name = node.type.name;
    if (name === "InlineCode") {
      return true;
    }
    if (FENCED_CODE_NODE_NAMES.has(name)) {
      return true;
    }
  }

  return false;
}

export function isInsideMrDiscussBlock(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  let node: SyntaxNode | null = tree.resolveInner(pos, 1);

  for (; node; node = node.parent) {
    if (!FENCED_CODE_NODE_NAMES.has(node.type.name)) {
      continue;
    }

    const { language } = readFencedCodeInfo(view, node);
    return language === MR_DISCUSS_CODE_BLOCK;
  }

  return false;
}

export function rangesOverlap(
  aFrom: number,
  aTo: number,
  bFrom: number,
  bTo: number,
): boolean {
  return aFrom < bTo && bFrom < aTo;
}
