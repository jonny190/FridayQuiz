"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Mail, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

type TeamFromApi = {
  id: string;
  name: string;
  contactEmail: string;
  isActive: boolean;
  _count: { members: number };
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamFromApi | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TeamFromApi | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contactEmail: "",
    members: "",
  });

  async function load() {
    try {
      const res = await fetch("/api/teams", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load teams (${res.status})`);
      const data = (await res.json()) as TeamFromApi[];
      setTeams(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const openNewTeamDialog = () => {
    setEditingTeam(null);
    setFormData({ name: "", contactEmail: "", members: "" });
    setIsDialogOpen(true);
  };

  const openEditTeamDialog = (team: TeamFromApi) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      contactEmail: team.contactEmail,
      members: "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveTeam = async () => {
    const name = formData.name.trim();
    const contactEmail = formData.contactEmail.trim();
    if (!name || !contactEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      if (editingTeam) {
        const res = await fetch(`/api/teams/${editingTeam.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, contactEmail }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to update team");
          return;
        }
        toast.success("Team updated");
      } else {
        const res = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            contactEmail,
            members: formData.members,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to create team");
          return;
        }
        toast.success("Team created");
      }
      setIsDialogOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save team");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    const team = pendingDelete;
    if (!team) return;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete team");
        return;
      }
      toast.success(`${team.name} deleted`);
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete team");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-muted-foreground">Manage your quiz teams</p>
        </div>
        <Button onClick={openNewTeamDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Team
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading teams…</CardTitle>
          </CardHeader>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load teams</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : teams.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              No teams yet
            </CardTitle>
            <CardDescription>
              Create your first team to get started with Friday Quiz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openNewTeamDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Teams ({teams.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {team.contactEmail}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {team._count.members} member
                        {team._count.members === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditTeamDialog(team)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(team)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent>
          <SheetHeader className="text-left">
            <SheetTitle>{editingTeam ? "Edit Team" : "New Team"}</SheetTitle>
            <SheetDescription>
              {editingTeam
                ? "Update the team details below."
                : "Add a new team to participate in Friday Quiz."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="teamName">Team Name *</Label>
              <Input
                id="teamName"
                placeholder="e.g. The Quizzards"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="captain@team.com"
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
              />
            </div>
            {!editingTeam && (
              <div className="grid gap-2">
                <Label htmlFor="members">
                  Add Members (email addresses, one per line)
                </Label>
                <textarea
                  id="members"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="member1@email.com&#10;member2@email.com"
                  value={formData.members}
                  onChange={(e) =>
                    setFormData({ ...formData, members: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll create user records for these emails so they can
                  sign in with a magic link.
                </p>
              </div>
            )}
          </div>
          <SheetFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTeam} disabled={saving}>
              {saving
                ? "Saving…"
                : `${editingTeam ? "Update" : "Create"} Team`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this team?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `"${pendingDelete.name}" and all its members, answers, and results will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
