'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent, FocusEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, AlertCircle, Pencil, X, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { betterbase } from '@/lib/betterbase';

type RowData = Record<string, unknown>;

interface TableEditorProps {
  tableName: string;
}

// Skeleton component for loading state
function SkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columnCount + 1 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted animate-pulse rounded" />
        </td>
      ))}
    </tr>
  );
}

// Modal component for adding new rows
function AddRowModal({
  isOpen,
  onClose,
  onSubmit,
  columns,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RowData) => void;
  columns: string[];
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<RowData>({});

  useEffect(() => {
    if (isOpen) {
      // Initialize form with empty values for each column
      const initialData: RowData = {};
      columns.forEach((col) => {
        initialData[col] = '';
      });
      setFormData(initialData);
    }
  }, [isOpen, columns]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out empty values and convert types
    const cleanedData: RowData = {};
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        cleanedData[key] = value;
      }
    });
    onSubmit(cleanedData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Add New Row</CardTitle>
            <CardDescription>Enter values for the new row</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {columns.map((column) => (
              <div key={column} className="space-y-2">
                <label htmlFor={column} className="text-sm font-medium">
                  {column}
                </label>
                <input
                  id={column}
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={String(formData[column] ?? '')}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [column]: e.target.value }))}
                />
              </div>
            ))}
          </CardContent>
          <div className="flex justify-end gap-2 p-6 pt-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Row'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// Confirm delete dialog
function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Delete Row
          </CardTitle>
          <CardDescription>
            Are you sure you want to delete this row? This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <div className="flex justify-end gap-2 p-6 pt-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Inline editable cell component
function EditableCell({
  value,
  column,
  rowId,
  onSave,
  isIdColumn,
}: {
  value: unknown;
  column: string;
  rowId: string;
  onSave: (column: string, value: unknown) => void;
  isIdColumn: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const newValue = editValue;
    // Only save if value changed
    if (String(value ?? '') !== newValue) {
      onSave(column, newValue);
    }
    setIsEditing(false);
  }, [editValue, value, column, onSave]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(String(value ?? ''));
      setIsEditing(false);
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    // Only save if not clicking on a button
    handleSave();
  };

  if (isIdColumn) {
    return (
      <span className="font-mono text-xs text-muted-foreground">{String(value ?? '')}</span>
    );
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="w-full rounded border border-primary bg-background px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    );
  }

  return (
    <div
      className="group flex items-center gap-1 cursor-pointer min-h-[1.5rem]"
      onClick={() => setIsEditing(true)}
    >
      <span className="text-sm truncate max-w-[200px]">
        {value === null ? (
          <span className="text-muted-foreground italic">null</span>
        ) : value === undefined ? (
          <span className="text-muted-foreground italic">undefined</span>
        ) : typeof value === 'object' ? (
          <span className="text-muted-foreground">{JSON.stringify(value)}</span>
        ) : (
          String(value)
        )}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
    </div>
  );
}

export function TableEditor({ tableName }: TableEditorProps) {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);

  // Check if betterbase URL is configured
  const isConfigured = process.env.NEXT_PUBLIC_BETTERBASE_URL !== undefined;

  // Fetch rows from the table
  const {
    data: queryResult,
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const result = await betterbase.from<RowData>(tableName).execute();
      if (result.error) {
        throw result.error;
      }
      return result;
    },
    enabled: isConfigured,
  });

  const rows = queryResult?.data ?? [];
  
  // Extract columns from the first row, or use empty array
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const idColumn = columns.find((col) => col.toLowerCase() === 'id') || columns[0];

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RowData> }) => {
      const result = await betterbase.from<RowData>(tableName).update(id, data);
      if (result.error) {
        throw result.error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
    },
  });

  // Insert mutation
  const insertMutation = useMutation({
    mutationFn: async (data: RowData) => {
      const result = await betterbase.from<RowData>(tableName).insert(data);
      if (result.error) {
        throw result.error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
      setIsAddModalOpen(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await betterbase.from<RowData>(tableName).delete(id);
      if (result.error) {
        throw result.error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
      setDeleteRowId(null);
    },
  });

  // Handle cell edit save
  const handleCellSave = useCallback(
    (rowId: string, column: string, value: unknown) => {
      updateMutation.mutate({ id: rowId, data: { [column]: value } });
    },
    [updateMutation]
  );

  // Handle add row
  const handleAddRow = (data: RowData) => {
    insertMutation.mutate(data);
  };

  // Handle delete row
  const handleDeleteRow = () => {
    if (deleteRowId && deleteRowId !== '') {
      deleteMutation.mutate(deleteRowId);
    }
  };

  // Get row ID safely - returns undefined for invalid IDs
  const getRowId = (row: RowData): string | undefined => {
    const id = row[idColumn];
    if (id === null || id === undefined || id === '') {
      return undefined;
    }
    return String(id);
  };

  // Check if row has a valid ID
  const isValidRowId = (row: RowData): boolean => {
    return getRowId(row) !== undefined;
  };

  // Not configured state
  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tableName}</CardTitle>
          <CardDescription>Configure BetterBase to view table data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">BetterBase Not Configured</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Set <code className="bg-muted px-1 rounded">NEXT_PUBLIC_BETTERBASE_URL</code> in your
              environment to connect to your BetterBase backend.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load table data';
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tableName}</CardTitle>
          <CardDescription>Error loading table</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Table</h3>
            <p className="text-sm text-muted-foreground max-w-md">{errorMessage}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['table', tableName] })}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{tableName}</CardTitle>
            <CardDescription>
              {isLoading
                ? 'Loading...'
                : `${rows.length} row${rows.length !== 1 ? 's' : ''} found`}
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Loading state with skeleton rows
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Loading...</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} columnCount={3} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : rows.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Rows Found</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                This table is empty. Add your first row to get started.
              </p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Your First Row
              </Button>
            </div>
          ) : (
            // Table with data
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                      >
                        {column}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: RowData, rowIndex: number) => {
                    const rowId = getRowId(row);
                    const hasValidId = isValidRowId(row);
                    return (
                      <tr key={rowId || rowIndex} className="border-b last:border-b-0 hover:bg-muted/30">
                        {columns.map((column) => (
                          <td key={column} className="px-4 py-3">
                            <EditableCell
                              value={row[column]}
                              column={column}
                              rowId={rowId || ''}
                              onSave={(col, value) => rowId && handleCellSave(rowId, col, value)}
                              isIdColumn={column === idColumn}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => rowId && setDeleteRowId(rowId)}
                            disabled={!hasValidId}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Row Modal */}
      <AddRowModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddRow}
        columns={columns.filter((col) => col !== idColumn)} // Exclude ID column for new rows
        isLoading={insertMutation.isPending}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteRowId !== null}
        onClose={() => setDeleteRowId(null)}
        onConfirm={handleDeleteRow}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
