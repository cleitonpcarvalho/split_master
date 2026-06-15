"use client";

import { Eye, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { BooleanStatusBadge } from "@/components/dashboard/StatusBadge";
import { useDashboardUser } from "@/components/dashboard/DashboardShell";
import {
  type AdminUser,
  getAdminUsers,
  updateAdminUser,
} from "@/lib/api";
import type { UserPlan } from "@/lib/auth";
import { formatDate } from "@/lib/format";

const plans: UserPlan[] = ["free", "starter", "pro", "elite"];

export default function AdminUsersPage() {
  const { user } = useDashboardUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plan, setPlan] = useState<UserPlan | "all">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (user.role !== "admin") {
      return;
    }

    setLoading(true);
    getAdminUsers({
      plan: plan === "all" ? undefined : plan,
      status: status === "all" ? undefined : status,
    })
      .then(setUsers)
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [plan, status, user.role]);

  if (user.role !== "admin") {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Acesso restrito"
        description="Esta área está disponível somente para administradores."
      />
    );
  }

  async function changePlan(target: AdminUser, nextPlan: UserPlan) {
    setBusyId(target.id);

    try {
      const updated = await updateAdminUser(target.id, { plan: nextPlan });
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success("Plano atualizado.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleUser(target: AdminUser) {
    setBusyId(target.id);

    try {
      const updated = await updateAdminUser(target.id, {
        isActive: !target.isActive,
      });
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(updated.isActive ? "Usuário ativado." : "Usuário desativado.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gerencie clientes, planos e acesso à plataforma."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <FilterSelect
          label="Plano"
          value={plan}
          onChange={(value) => setPlan(value as UserPlan | "all")}
          options={[
            { value: "all", label: "Todos os planos" },
            ...plans.map((item) => ({ value: item, label: item })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(value) =>
            setStatus(value as "all" | "active" | "inactive")
          }
          options={[
            { value: "all", label: "Todos os status" },
            { value: "active", label: "Ativos" },
            { value: "inactive", label: "Inativos" },
          ]}
        />
      </div>

      {loading ? (
        <UsersLoading />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum usuário encontrado"
          description="Ajuste os filtros para visualizar outros clientes."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-navy/5 bg-white shadow-sm lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy/[0.025] text-xs uppercase tracking-wide text-navy/45">
                <tr>
                  <th className="px-5 py-3 font-bold">Usuário</th>
                  <th className="px-5 py-3 font-bold">Plano</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Cadastro</th>
                  <th className="px-5 py-3 font-bold">Quizzes</th>
                  <th className="px-5 py-3 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {users.map((target) => (
                  <tr key={target.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-navy">{target.name}</p>
                      <p className="text-xs text-navy/45">
                        {target.email} · {target.role}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <PlanSelect
                        user={target}
                        disabled={busyId === target.id}
                        onChange={(nextPlan) => changePlan(target, nextPlan)}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <BooleanStatusBadge active={target.isActive} />
                    </td>
                    <td className="px-5 py-4 text-navy/55">
                      {formatDate(target.createdAt)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-navy/65">
                      {target.quizzesCount}
                    </td>
                    <td className="px-5 py-4">
                      <UserActions
                        user={target}
                        busy={busyId === target.id}
                        onToggle={() => toggleUser(target)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 lg:hidden">
            {users.map((target) => (
              <article
                key={target.id}
                className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold text-navy">{target.name}</h2>
                    <p className="mt-1 break-all text-xs text-navy/45">
                      {target.email}
                    </p>
                  </div>
                  <BooleanStatusBadge active={target.isActive} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-navy/40">Plano</p>
                    <div className="mt-1">
                      <PlanSelect
                        user={target}
                        disabled={busyId === target.id}
                        onChange={(nextPlan) => changePlan(target, nextPlan)}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-navy/40">Quizzes</p>
                    <p className="mt-2 font-bold text-navy">{target.quizzesCount}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-navy/5 pt-3">
                  <UserActions
                    user={target}
                    busy={busyId === target.id}
                    onToggle={() => toggleUser(target)}
                    mobile
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function UserActions({
  user,
  busy,
  onToggle,
  mobile = false,
}: {
  user: AdminUser;
  busy: boolean;
  onToggle: () => void;
  mobile?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${mobile ? "" : "justify-end"}`}>
      <Link
        href={`/dashboard/quizzes?userId=${user.id}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-navy/60 hover:bg-navy/5 hover:text-navy"
      >
        <Eye className="h-4 w-4" />
        Ver quizzes
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className={`min-h-9 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${
          user.isActive
            ? "text-red-600 hover:bg-red-50"
            : "text-[#087A5B] hover:bg-green/10"
        }`}
      >
        {user.isActive ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}

function PlanSelect({
  user,
  disabled,
  onChange,
}: {
  user: AdminUser;
  disabled: boolean;
  onChange: (plan: UserPlan) => void;
}) {
  return (
    <select
      value={user.plan}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as UserPlan)}
      className="min-h-9 rounded-lg border border-navy/10 bg-white px-2 text-xs font-bold capitalize text-navy outline-none focus:border-green disabled:opacity-50"
    >
      {plans.map((plan) => (
        <option key={plan} value={plan}>
          {plan}
        </option>
      ))}
    </select>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy/45">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-navy/10 bg-white px-4 text-sm font-semibold capitalize text-navy outline-none focus:border-green sm:w-56"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UsersLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-20 rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}
