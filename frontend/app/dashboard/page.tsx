"use client";

import {
  CheckCircle2,
  FileQuestion,
  MousePointerClick,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuizStatusBadge } from "@/components/dashboard/StatusBadge";
import { useDashboardUser } from "@/components/dashboard/DashboardShell";
import {
  type DashboardData,
  getDashboardData,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function DashboardPage() {
  const { user } = useDashboardUser();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
      });
  }, []);

  if (!data) {
    return <DashboardSkeleton />;
  }

  if (data.role === "admin") {
    return (
      <>
        <PageHeader
          title={`Olá, ${user.name}!`}
          description="Acompanhe a saúde da plataforma e os números de todos os clientes."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total de usuários" value={data.summary.users} icon={Users} />
          <StatCard
            label="Usuários ativos"
            value={data.summary.activeUsers}
            icon={UserCheck}
          />
          <StatCard
            label="Todos os quizzes"
            value={data.summary.quizzes}
            icon={FileQuestion}
          />
          <StatCard label="Leads captados" value={data.summary.leads} icon={TrendingUp} />
        </div>

        <RecentQuizzes quizzes={data.recentQuizzes} admin />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name}!`}
        description="Aqui está um resumo do desempenho dos seus funis."
        action={
          <Link
            href="/dashboard/quizzes?new=true"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-green px-5 text-sm font-extrabold text-navy shadow-lg shadow-green/20 transition hover:bg-[#08D29A]"
          >
            Criar novo quiz
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de Quizzes"
          value={data.summary.quizzes}
          icon={FileQuestion}
        />
        <StatCard label="Leads captados" value={data.summary.leads} icon={Users} />
        <StatCard
          label="Taxa de conclusão"
          value={`${data.summary.completionRate}%`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Cliques no checkout"
          value={data.summary.checkoutClicks}
          icon={MousePointerClick}
        />
      </div>

      <RecentQuizzes quizzes={data.recentQuizzes} />

      <section className="mt-7 rounded-2xl border border-navy/5 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-navy/5 px-5 py-4">
          <div>
            <h2 className="font-extrabold text-navy">Leads recentes</h2>
            <p className="mt-0.5 text-xs text-navy/45">
              Os últimos contatos capturados
            </p>
          </div>
          <Link
            href="/dashboard/leads"
            className="text-sm font-bold text-[#008A64] hover:text-green"
          >
            Ver todos
          </Link>
        </div>

        {data.recentLeads.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="Nenhum lead capturado"
              description="Assim que alguém responder um quiz, os dados aparecerão aqui."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-navy/[0.025] text-xs uppercase tracking-wide text-navy/45">
                <tr>
                  <th className="px-5 py-3 font-bold">Lead</th>
                  <th className="px-5 py-3 font-bold">Quiz</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {data.recentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-navy">
                        {lead.name || "Lead sem nome"}
                      </p>
                      <p className="text-xs text-navy/45">
                        {lead.email || "Sem e-mail"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-navy/65">{lead.quizTitle}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          lead.completed
                            ? "bg-green/10 text-[#087A5B]"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {lead.completed ? "Concluído" : "Em andamento"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-navy/55">
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function RecentQuizzes({
  quizzes,
  admin = false,
}: {
  quizzes: Extract<DashboardData, { role: "client" }>["recentQuizzes"];
  admin?: boolean;
}) {
  return (
    <section className="mt-7 rounded-2xl border border-navy/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-navy/5 px-5 py-4">
        <div>
          <h2 className="font-extrabold text-navy">
            {admin ? "Quizzes recentes da plataforma" : "Seus últimos quizzes"}
          </h2>
          <p className="mt-0.5 text-xs text-navy/45">
            Os cinco quizzes mais recentes
          </p>
        </div>
        <Link
          href="/dashboard/quizzes"
          className="text-sm font-bold text-[#008A64] hover:text-green"
        >
          Ver todos
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={FileQuestion}
            title="Nenhum quiz criado"
            description="Crie seu primeiro quiz para começar a captar e qualificar leads."
          />
        </div>
      ) : (
        <div className="divide-y divide-navy/5">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-bold text-navy">{quiz.title}</p>
                <p className="mt-1 text-xs text-navy/45">
                  /{quiz.slug} · {quiz.leadsCount} leads
                </p>
              </div>
              <div className="flex items-center gap-4">
                <QuizStatusBadge status={quiz.status} />
                <span className="text-xs text-navy/40">
                  {formatDate(quiz.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-9 w-64 rounded bg-navy/10" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-navy/5" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar o painel.";
}
