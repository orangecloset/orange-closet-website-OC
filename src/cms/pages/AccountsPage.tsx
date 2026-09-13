import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useToast } from "../components/toastContext";
import {
  Badge,
  Button,
  ConfirmDialog,
  Container,
  Header,
  Input,
  Label,
  Modal,
} from "../components/ui";
import { api, type CmsUser } from "../lib/api";

const CACHE_TTL_MS = 60_000;
const accountsCache = { data: null as CmsUser[] | null, ts: 0 };
import { getCmsSession, updateStoredUser, authClient } from "../store/auth";
import { formatDate } from "../lib/utils";

function roleBadge(role: string) {
  if (role === "super_admin") {
    return (
      <Badge color="orange" className="min-w-[104px]">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Super Admin
        </span>
      </Badge>
    );
  }
  if (role === "staff") {
    return (
      <Badge color="green" className="min-w-[104px]">
        Staff
      </Badge>
    );
  }
  return (
    <Badge color="grey" className="min-w-[104px]">
      Blocked
    </Badge>
  );
}

export default function AccountsPage() {
  const { showToast } = useToast();
  const me = getCmsSession()?.user ?? null;
  const isSuperAdmin = me?.role === "super_admin";

  const accountsValid = accountsCache.data && Date.now() - accountsCache.ts < CACHE_TTL_MS;

  const [users, setUsers] = useState<CmsUser[]>(accountsValid ? accountsCache.data! : []);
  const [loading, setLoading] = useState(!accountsValid);
  const [deleteTarget, setDeleteTarget] = useState<CmsUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [createError, setCreateError] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    const now = Date.now();
    if (accountsCache.data && now - accountsCache.ts < CACHE_TTL_MS) {
      setUsers(accountsCache.data);
      setLoading(false);
      return;
    }
    try {
      const data = await api.listUsers();
      accountsCache.data = data;
      accountsCache.ts = Date.now();
      setUsers(data);
    } catch (err) {
      console.error("[cms] failed to load users", err);
      showToast("Couldn't load accounts. (ACC_01)");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSetRole = async (user: CmsUser, role: "staff" | "pending") => {
    setBusyId(user.id);
    try {
      await api.setUserRole(user.id, role);
      showToast(role === "staff" ? `${user.email} unblocked.` : `${user.email} blocked.`);
      await loadUsers();
    } catch (err) {
      console.error("[cms] failed to update user", err);
      showToast("Couldn't update the account. (ACC_02)");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api.deleteUser(deleteTarget.id);
      showToast(`${deleteTarget.email} removed.`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      console.error("[cms] failed to delete user", err);
      showToast("Couldn't remove the account. (ACC_03)");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreatingBusy(true);
    try {
      await api.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      showToast(`${form.email.trim()} created.`);
      setCreating(false);
      setForm({ name: "", email: "", password: "" });
      await loadUsers();
    } catch (err) {
      console.error("[cms] failed to create user", err);
      const message = err instanceof Error ? err.message : "";
      if (message.includes("409")) {
        setCreateError("An account with this email already exists.");
      } else if (message.includes("400")) {
        setCreateError("Check the details — email format or password length.");
      } else {
        setCreateError("Couldn't create the account. Please try again. (ACC_04)");
      }
    } finally {
      setCreatingBusy(false);
    }
  };

  const staffCount = users.filter((u) => u.role === "staff").length;
  const pendingCount = users.filter((u) => u.role === "pending").length;

  const [editTarget, setEditTarget] = useState<CmsUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditAccount = (u: CmsUser) => {
    setEditTarget(u);
    setEditForm({ name: u.name, email: u.email });
    setEditError("");
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const name = editForm.name.trim();
    const email = editForm.email.trim().toLowerCase();
    if (!name) return setEditError("Name is required.");
    if (!/.+@.+\..+/.test(email)) return setEditError("A valid email is required.");
    setSavingEdit(true);
    setEditError("");
    try {
      await api.updateAccount(editTarget.id, { name, email });
      showToast(`${email} updated.`);
      setEditTarget(null);
      await loadUsers();
      if (me && editTarget.id === me.id) updateStoredUser({ name, email });
    } catch (err) {
      console.error("[cms] failed to update account", err);
      setEditError("Couldn't save the changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", currentPassword: "", newPassword: "" });
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const openProfileEditor = () => {
    setProfile({ name: me?.name ?? "", email: me?.email ?? "", currentPassword: "", newPassword: "" });
    setProfileError("");
    setProfileOpen(true);
  };

  const handleProfileSave = async () => {
    if (!me) return;
    const name = profile.name.trim();
    const email = profile.email.trim().toLowerCase();
    const nameChanged = name !== me.name;
    const emailChanged = email !== me.email.toLowerCase();
    const wantsPassword = Boolean(profile.newPassword || profile.currentPassword);

    if (!name) return setProfileError("Name is required.");
    if (!/.+@.+\..+/.test(email)) return setProfileError("A valid email is required.");
    if (wantsPassword && !profile.currentPassword) {
      return setProfileError("Enter your current password to change it.");
    }
    if (profile.newPassword && profile.newPassword.length < 8) {
      return setProfileError("New password must be at least 8 characters.");
    }

    setSavingProfile(true);
    setProfileError("");
    try {
      if (profile.newPassword) {
        const res = await authClient.changePassword({
          currentPassword: profile.currentPassword,
          newPassword: profile.newPassword,
          revokeOtherSessions: true,
        });
        if (res?.error) {
          throw new Error(res.error.message || "Couldn't change the password. Check your current password.");
        }
      }
      let authNameOk = true;
      let authEmailOk = true;
      if (nameChanged) {
        const res = await authClient.updateUser({ name });
        authNameOk = !res?.error;
      }
      if (emailChanged) {
        const res = await authClient.changeEmail({ newEmail: email });
        authEmailOk = !res?.error;
      }
      if (!authNameOk || !authEmailOk) {
        throw new Error(
          !authEmailOk
            ? "Couldn't change the email. It may already be in use."
            : "Couldn't update your sign-in profile."
        );
      }

      try {
        await api.updateOwnProfile({
          ...(nameChanged ? { name } : {}),
          ...(emailChanged ? { email } : {}),
        });
      } catch {
        showToast("Saved, but the CMS list couldn't be refreshed. It will sync on next sign-in.");
      }
      updateStoredUser({ name, email });
      showToast("Your account has been updated.");
      setProfileOpen(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Couldn't save your changes. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const myAccountButton = (
    <Button variant="secondary" size="small" onClick={openProfileEditor}>
      My Account
    </Button>
  );

  const profileModal = (
    <Modal
      open={profileOpen}
      onClose={() => setProfileOpen(false)}
      title="My Account"
      description="Update your name, email or password."
      footer={
        <>
          <Button variant="secondary" size="small" type="button" onClick={() => setProfileOpen(false)} disabled={savingProfile}>
            Cancel
          </Button>
          <Button variant="primary" size="small" type="button" onClick={handleProfileSave} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleProfileSave();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder="Your name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-current-pass">Current Password</Label>
          <Input
            id="profile-current-pass"
            type="password"
            value={profile.currentPassword}
            onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })}
            placeholder="Your current password"
            autoComplete="current-password"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-new-pass">New Password</Label>
          <Input
            id="profile-new-pass"
            type="password"
            value={profile.newPassword}
            onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })}
            placeholder="New password (at least 8 characters)"
            autoComplete="new-password"
          />
        </div>
        {profileError && <p className="text-sm text-[var(--fg-error)]">{profileError}</p>}
      </form>
    </Modal>
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col gap-y-3">
        <Header title="Accounts" subtitle="Your CMS account" actions={myAccountButton} />
        <Container>
          <div className="px-6 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[var(--fg-base)]">
                {me?.name}
                <span className="ml-1.5 text-xs text-[var(--fg-muted)]">(you)</span>
              </span>
              <span className="text-sm text-[var(--fg-muted)]">{me?.email}</span>
            </div>
            <div className="mt-3">{roleBadge("staff")}</div>
          </div>
        </Container>
        {profileModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title="Accounts"
        subtitle="Create staff accounts and manage access"
        actions={
          <>
            {myAccountButton}
            <Button variant="primary" size="small" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </>
        }
      />

      <Container>
        <div className="px-6 py-3 text-xs text-[var(--fg-muted)]">
          Signed in as <span className="font-medium text-[var(--fg-base)]">{me?.email}</span>
        </div>

        <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--fg-muted)]">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="w-36 px-4 py-2.5 font-medium">Role</th>
                <th className="w-32 px-4 py-2.5 font-medium">Joined</th>
                <th className="w-44 px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
                    No accounts yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isMe = u.id === me?.id;
                  const isSuper = u.role === "super_admin";
                  return (
                    <tr key={u.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                      <td className="max-w-[180px] truncate px-4 py-3 text-sm text-[var(--fg-base)]">
                        {u.name}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-[var(--fg-muted)]">(you)</span>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-sm text-[var(--fg-base)]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">{roleBadge(u.role)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--fg-muted)]">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isSuper && (
                            <>
                              <Button
                                variant="ghost"
                                size="small"
                                disabled={busyId === u.id}
                                onClick={() => openEditAccount(u)}
                                aria-label={`Edit ${u.email}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {u.role === "pending" ? (
                                <Button
                                  variant="primary"
                                  size="small"
                                  style={{ width: 104 }}
                                  disabled={busyId === u.id}
                                  onClick={() => handleSetRole(u, "staff")}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Unblock
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="small"
                                  style={{ width: 104 }}
                                  disabled={busyId === u.id}
                                  onClick={() => handleSetRole(u, "pending")}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Block
                                </Button>
                              )}
                              <Button
                                variant="danger"
                                size="small"
                                disabled={busyId === u.id}
                                onClick={() => setDeleteTarget(u)}
                                aria-label={`Remove ${u.email}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-xs text-[var(--fg-muted)]">
            {users.length} account{users.length === 1 ? "" : "s"} · {staffCount} staff
            {pendingCount > 0 ? ` · ${pendingCount} blocked` : ""} · super admin cannot be modified
          </div>
        </div>
      </Container>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add Account"
        description="Creates a staff account that can sign in right away."
        footer={
          <>
            <Button variant="secondary" size="small" type="button" onClick={() => setCreating(false)} disabled={creatingBusy}>
              Cancel
            </Button>
            <Button variant="primary" size="small" type="submit" form="create-account-form" disabled={creatingBusy}>
              Create Account
            </Button>
          </>
        }
      >
        <form id="create-account-form" onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-name">Name</Label>
            <Input
              id="acc-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Their name"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-email">Email</Label>
            <Input
              id="acc-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="staff@example.com"
              required
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-password">Password</Label>
            <Input
              id="acc-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          {createError && <p className="text-sm text-[var(--fg-error)]">{createError}</p>}
        </form>
      </Modal>

      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit Account"
        description={editTarget ? `Editing ${editTarget.email}` : ""}
        footer={
          <>
            <Button variant="secondary" size="small" type="button" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button variant="primary" size="small" type="button" onClick={handleEditSave} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          {editError && <p className="text-sm text-[var(--fg-error)]">{editError}</p>}
        </div>
      </Modal>

      {profileModal}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Account"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.email}? They will immediately lose access to the CMS.`
            : ""
        }
        confirmLabel="Remove"
      />
    </div>
  );
}
