import { TableEditor } from '@/components/tables/table-editor';

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  return <TableEditor tableName={table} />;
}
