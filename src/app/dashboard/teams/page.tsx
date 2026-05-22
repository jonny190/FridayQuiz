"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Users, Plus, Mail, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  contactEmail: string;
  memberCount: number;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactEmail: "",
    members: "",
  });

  const openNewTeamDialog = () => {
    setEditingTeam(null);
    setFormData({ name: "", contactEmail: "", members: "" });
    setIsDialogOpen(true);
  };

  const openEditTeamDialog = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      contactEmail: team.contactEmail,
      members: "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveTeam = () => {
    if (!formData.name.trim() || !formData.contactEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingTeam) {
      setTeams(
        teams.map((t) =>
          t.id === editingTeam.id
            ? { ...t, name: formData.name, contactEmail: formData.contactEmail }
            : t
        )
      );
      toast.success("Team updated successfully");
    } else {
      const newTeam: Team = {
        id: crypto.randomUUID(),
        name: formData.name,
        contactEmail: formData.contactEmail,
        memberCount: 0,
      };
      setTeams([...teams, newTeam]);
      toast.success("Team created successfully");
    }
    setIsDialogOpen(false);
  };

  const handleDeleteTeam = (id: string) => {
    setTeams(teams.filter((t) => t.id !== id));
    toast.success("Team deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-muted-foreground">
            Manage your quiz teams
          </p>
        </div>
        <Button onClick={openNewTeamDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Team
        </Button>
      </div>

      {teams.length === 0 ? (
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
                        {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
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
                          onClick={() => handleDeleteTeam(team.id)}
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
            <SheetTitle>
              {editingTeam ? "Edit Team" : "New Team"}
            </SheetTitle>
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
            </div>
          </div>
          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTeam}>
              {editingTeam ? "Update" : "Create"} Team
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}