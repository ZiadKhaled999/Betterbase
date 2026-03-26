import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Bell } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const notificationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  metric: z.string().min(1, "Metric is required"),
  threshold: z.number().min(0),
  channel: z.enum(["email", "webhook"]),
  target: z.string().min(1, "Target is required"),
  enabled: z.boolean(),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

interface NotificationRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  channel: string;
  target: string;
  enabled: boolean;
}

const METRICS = [
  { value: "error_rate", label: "Error Rate (%)" },
  { value: "latency_p95", label: "P95 Latency (ms)" },
  { value: "latency_p99", label: "P99 Latency (ms)" },
  { value: "request_count", label: "Request Count" },
  { value: "active_users", label: "Active Users" },
];

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "webhook", label: "Webhook" },
];

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteRule, setDeleteRule] = useState<NotificationRule | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QK.notifications(),
    queryFn: () => api.get<{ notifications: NotificationRule[] }>("/admin/notifications"),
  });

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      name: "",
      metric: "error_rate",
      threshold: 5,
      channel: "email",
      target: "",
      enabled: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: NotificationFormData) => api.post("/admin/notifications", data),
    onSuccess: () => {
      toast.success("Notification rule created");
      setShowCreateDialog(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: QK.notifications() });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/admin/notifications/${id}`, { enabled }),
    onSuccess: () => {
      toast.success("Notification rule updated");
      queryClient.invalidateQueries({ queryKey: QK.notifications() });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/notifications/${id}`),
    onSuccess: () => {
      toast.success("Notification rule deleted");
      queryClient.invalidateQueries({ queryKey: QK.notifications() });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Manage notification rules for your instance"
        action={
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus size={16} className="mr-2" />
            Create Rule
          </Button>
        }
      />

      <div className="px-8 pb-8">
        <Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--color-text-primary)" }}>
              <Bell size={18} className="inline mr-2" />
              Notification Rules
            </CardTitle>
            <CardDescription style={{ color: "var(--color-text-secondary)" }}>
              Configure alerts based on metrics and thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.notifications?.length === 0 ? (
              <div className="text-center py-8" style={{ color: "var(--color-text-muted)" }}>
                No notification rules configured yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.notifications?.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell style={{ color: "var(--color-text-primary)" }}>
                        {rule.name}
                      </TableCell>
                      <TableCell style={{ color: "var(--color-text-secondary)" }}>
                        {METRICS.find((m) => m.value === rule.metric)?.label || rule.metric}
                      </TableCell>
                      <TableCell style={{ color: "var(--color-text-secondary)" }}>
                        {rule.threshold}
                      </TableCell>
                      <TableCell style={{ color: "var(--color-text-secondary)" }}>
                        <span className="capitalize">{rule.channel}</span>
                      </TableCell>
                      <TableCell style={{ color: "var(--color-text-secondary)" }}>
                        {rule.target}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: rule.id, enabled: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRule(rule)}
                        >
                          <Trash2 size={16} style={{ color: "var(--color-danger)" }} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "var(--color-text-primary)" }}>
                Create Notification Rule
              </DialogTitle>
              <DialogDescription style={{ color: "var(--color-text-secondary)" }}>
                Set up a new notification rule to monitor metrics
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}>
              <div className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input {...form.register("name")} placeholder="High error rate alert" />
                </div>
                <div className="grid gap-2">
                  <Label>Metric</Label>
                  <Select
                    value={form.watch("metric")}
                    onValueChange={(value) => form.setValue("metric", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRICS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    {...form.register("threshold", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Channel</Label>
                  <Select
                    value={form.watch("channel")}
                    onValueChange={(value) => form.setValue("channel", value as "email" | "webhook")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Target</Label>
                  <Input
                    {...form.register("target")}
                    placeholder={form.watch("channel") === "email" ? "admin@example.com" : "https://..."}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteRule}
          onOpenChange={(open) => !open && setDeleteRule(null)}
          title="Delete Notification Rule"
          description={`Are you sure you want to delete "${deleteRule?.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            if (deleteRule) {
              deleteMutation.mutate(deleteRule.id);
            }
          }}
          loading={deleteMutation.isPending}
        />
      </div>
    </div>
  );
}