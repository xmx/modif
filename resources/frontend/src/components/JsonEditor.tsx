import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";

/** JSON 编辑器扩展：JSON 语法高亮 + 错误下划线提示 */
const jsonExtensions = [json(), lintGutter(), linter(jsonParseLinter())];

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
}

export default function JsonEditor({ value, onChange, dark }: JsonEditorProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={jsonExtensions}
        theme={dark ? oneDark : "light"}
        height="160px"
        className="text-xs"
      />
    </div>
  );
}