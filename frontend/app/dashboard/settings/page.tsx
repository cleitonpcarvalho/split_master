"use client";

import { CreditCard, LockKeyhole, type LucideIcon, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { useDashboardUser } from "@/components/dashboard/DashboardShell";
import { FormField } from "@/components/FormField";
import { updatePassword, updateProfile } from "@/lib/api";

export default function SettingsPage() {
  const { user, setUser } = useDashboardUser();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileLoading(true);

    try {
      const updatedUser = await updateProfile({ name, email });
      setUser(updatedUser);
      toast.success("Dados da conta atualizados.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmation) {
      toast.error("A confirmação não corresponde à nova senha.");
      return;
    }

    setPasswordLoading(true);

    try {
      await updatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      toast.success("Senha atualizada com sucesso.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Configurações da conta"
        description="Atualize seus dados pessoais, senha e informações do plano."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7">
          <SectionTitle icon={UserRound} title="Dados pessoais" />
          <form onSubmit={saveProfile} className="mt-6 space-y-5">
            <FormField
              id="settings-name"
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
            />
            <FormField
              id="settings-email"
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button
              type="submit"
              disabled={profileLoading}
              className="min-h-11 rounded-full bg-green px-6 text-sm font-extrabold text-navy disabled:opacity-60"
            >
              {profileLoading ? "Salvando..." : "Salvar dados"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7">
          <SectionTitle icon={LockKeyhole} title="Alterar senha" />
          <form onSubmit={savePassword} className="mt-6 space-y-5">
            <FormField
              id="current-password"
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <FormField
              id="new-password"
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              required
            />
            <FormField
              id="password-confirmation"
              label="Confirme a nova senha"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              maxLength={72}
              required
            />
            <button
              type="submit"
              disabled={passwordLoading}
              className="min-h-11 rounded-full bg-navy px-6 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {passwordLoading ? "Atualizando..." : "Alterar senha"}
            </button>
          </form>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7">
        <SectionTitle icon={CreditCard} title="Seu plano" />
        <div className="mt-5 flex flex-col gap-5 rounded-2xl bg-navy p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
              Plano atual
            </p>
            <p className="mt-1 text-2xl font-extrabold capitalize text-green">
              {user.plan}
            </p>
            <p className="mt-2 text-sm text-white/60">
              Amplie seus limites e desbloqueie mais recursos para converter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast.info("A contratação de planos será habilitada em breve.")}
            className="min-h-11 rounded-full bg-green px-6 text-sm font-extrabold text-navy"
          >
            Fazer upgrade
          </button>
        </div>
      </section>
    </>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-green/10 p-2.5 text-[#008A64]">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-extrabold text-navy">{title}</h2>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}
