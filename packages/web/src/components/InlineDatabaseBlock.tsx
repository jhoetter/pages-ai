import { DatabaseTableView } from "@/components/DatabaseTableView";

export function InlineDatabaseBlock(props: { databaseId: string }) {
  return (
    <DatabaseTableView databaseId={props.databaseId} compact showOpenLink omitTitleRow={false} />
  );
}
