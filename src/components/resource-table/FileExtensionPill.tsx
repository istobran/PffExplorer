import { fileExtensionLabel } from "@/lib/format";
import { Tag } from "@/components/Tag";

export type FileExtensionPillProps = {
  name: string;
};

export function FileExtensionPill(props: FileExtensionPillProps) {
  return <Tag className="file-extension-pill">{fileExtensionLabel(props.name)}</Tag>;
}
