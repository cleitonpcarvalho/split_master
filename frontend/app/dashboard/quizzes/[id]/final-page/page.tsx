"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleDollarSign,
  GripVertical,
  Heading1,
  Heading2,
  ImagePlus,
  Laptop,
  ListChecks,
  LoaderCircle,
  Minus,
  MonitorSmartphone,
  MousePointerClick,
  Plus,
  Quote,
  Save,
  Smartphone,
  Space,
  Text,
  Trash2,
  Video,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { FinalPageRenderer } from "@/components/final-page/FinalPageRenderer";
import {
  type CheckoutConfig,
  type FinalPageBlock,
  type FinalPageBlockType,
  type Quiz,
  createFinalPageBlock,
  deleteFinalPageBlock,
  getCheckoutConfigs,
  getFinalPageBlocks,
  getQuiz,
  getQuizQuestions,
  reorderFinalPageBlocks,
  updateFinalPageBlock,
  uploadFinalPageImage,
} from "@/lib/api";

type SaveState = "saved" | "dirty" | "saving";
type MobileTab = "editor" | "preview";

const blockCatalog: Array<{
  type: FinalPageBlockType;
  label: string;
  icon: LucideIcon;
}> = [
  { type: "title", label: "Título", icon: Heading1 },
  { type: "subtitle", label: "Subtítulo", icon: Heading2 },
  { type: "paragraph", label: "Parágrafo", icon: Text },
  { type: "image", label: "Imagem", icon: ImagePlus },
  { type: "video", label: "Vídeo", icon: Video },
  { type: "bullets", label: "Lista", icon: ListChecks },
  { type: "testimonial", label: "Depoimento", icon: Quote },
  { type: "cta_button", label: "Botão CTA", icon: MousePointerClick },
  { type: "checkout_button", label: "Checkout", icon: WalletCards },
  { type: "divider", label: "Divisor", icon: Minus },
  { type: "spacer", label: "Espaço", icon: Space },
];

export default function FinalPageEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = params.id;
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [blocks, setBlocks] = useState<FinalPageBlock[]>([]);
  const [checkouts, setCheckouts] = useState<CheckoutConfig[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addAfterId, setAddAfterId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinalPageBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const dirtyIds = useRef(new Set<string>());
  const saving = useRef(false);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);

  useEffect(() => {
    Promise.all([
      getQuiz(quizId),
      getFinalPageBlocks(quizId),
      getQuizQuestions(quizId),
      getCheckoutConfigs(quizId),
    ])
      .then(([quizData, blockData, questions, checkoutData]) => {
        setQuiz(quizData);
        setBlocks(blockData);
        setSelectedId(blockData[0]?.id ?? null);
        setCheckouts(checkoutData);
        setVariables(
          Array.from(
            new Set(
              questions
                .flatMap((question) => [
                  question.variableName,
                  question.type === "name" ||
                  question.type === "email" ||
                  question.type === "phone"
                    ? question.type
                    : null,
                ])
                .filter((value): value is string => Boolean(value)),
            ),
          ),
        );
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [quizId]);

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedId) ?? null,
    [blocks, selectedId],
  );
  const previewVariables = useMemo(
    () =>
      Object.fromEntries(
        variables.map((variable) => [
          variable,
          variable === "name"
            ? "João"
            : variable === "email"
              ? "joao@exemplo.com"
              : variable === "phone"
                ? "(11) 99999-9999"
                : "valor",
        ]),
      ),
    [variables],
  );

  const saveChanges = useCallback(
    async (silent = false): Promise<boolean> => {
      const ids = Array.from(dirtyIds.current);

      if (ids.length === 0) {
        return true;
      }
      if (saving.current) {
        return false;
      }

      saving.current = true;
      setSaveState("saving");
      const snapshot = blocks.filter((block) => ids.includes(block.id));

      try {
        await Promise.all(
          snapshot.map((block) =>
            updateFinalPageBlock(quizId, block.id, {
              content: block.content,
              settings: block.settings,
            }),
          ),
        );
        ids.forEach((id) => dirtyIds.current.delete(id));
        setSaveState(dirtyIds.current.size > 0 ? "dirty" : "saved");

        if (!silent) {
          toast.success("Página final salva.");
        }

        return true;
      } catch (error) {
        setSaveState("dirty");
        toast.error(getErrorMessage(error));
        return false;
      } finally {
        saving.current = false;
      }
    },
    [blocks, quizId],
  );

  useEffect(() => {
    saveRef.current = () => saveChanges(true);
  }, [saveChanges]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirtyIds.current.size > 0) {
        void saveRef.current();
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function preventUnsavedExit(event: BeforeUnloadEvent) {
      if (dirtyIds.current.size === 0) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", preventUnsavedExit);
    return () => window.removeEventListener("beforeunload", preventUnsavedExit);
  }, []);

  function patchBlock(
    blockId: string,
    section: "content" | "settings",
    patch: Record<string, unknown>,
  ) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, [section]: { ...block[section], ...patch } }
          : block,
      ),
    );
    dirtyIds.current.add(blockId);
    setSaveState("dirty");
  }

  async function selectBlock(id: string) {
    if (id !== selectedId && dirtyIds.current.size > 0) {
      await saveChanges(true);
    }
    setSelectedId(id);
  }

  async function addBlock(type: FinalPageBlockType, afterBlockId?: string) {
    setBusy(`add-${type}`);

    try {
      const previousIds = new Set(blocks.map((block) => block.id));
      const data = await createFinalPageBlock(quizId, { type, afterBlockId });
      const created = data.find((block) => !previousIds.has(block.id));
      setBlocks(data);
      setSelectedId(created?.id ?? data.at(-1)?.id ?? null);
      setAddAfterId(null);
      setMobileTab("editor");
      toast.success("Bloco adicionado.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setBusy(deleteTarget.id);

    try {
      const data = await deleteFinalPageBlock(quizId, deleteTarget.id);
      dirtyIds.current.delete(deleteTarget.id);
      setBlocks(data);
      setSelectedId((current) =>
        current === deleteTarget.id ? (data[0]?.id ?? null) : current,
      );
      setDeleteTarget(null);
      toast.success("Bloco excluído.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) {
      return;
    }
    if (dirtyIds.current.size > 0 && !(await saveChanges(true))) {
      return;
    }

    const previous = blocks;
    const reordered = moveItem(
      blocks,
      result.source.index,
      result.destination.index,
    ).map((block, index) => ({ ...block, orderIndex: index }));
    setBlocks(reordered);

    try {
      const data = await reorderFinalPageBlocks(
        quizId,
        reordered.map((block) => block.id),
      );
      setBlocks(data);
      toast.success("Ordem atualizada.");
    } catch (error) {
      setBlocks(previous);
      toast.error(getErrorMessage(error));
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !selectedBlock) {
      return;
    }

    setBusy("image-upload");

    try {
      const image = await uploadFinalPageImage(quizId, file);
      patchBlock(selectedBlock.id, "content", { url: image.url });
      toast.success("Imagem enviada.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      event.target.value = "";
      setBusy(null);
    }
  }

  function goBack() {
    if (
      dirtyIds.current.size > 0 &&
      !window.confirm("Existem alterações não salvas. Deseja sair mesmo assim?")
    ) {
      return;
    }

    router.push(`/dashboard/quizzes/${quizId}/edit`);
  }

  if (loading) {
    return <FullPageLoading label="Carregando editor da página final..." />;
  }
  if (!quiz) {
    return <FullPageLoading label="Quiz não encontrado." spinning={false} />;
  }

  const primaryColor = getSetting(quiz.settings, "primaryColor", "#00C48C");
  const backgroundColor = getSetting(quiz.settings, "backgroundColor", "#FFFFFF");
  const logoUrl = getSetting(quiz.settings, "logoUrl", "");

  return (
    <DragDropContext onDragEnd={(result) => void handleDragEnd(result)}>
      <div className="min-h-screen bg-[#F4F6F8] text-navy">
        <header className="sticky top-0 z-30 flex min-h-[73px] flex-wrap items-center gap-3 border-b border-navy/10 bg-white px-4 py-3 shadow-sm sm:px-6">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy/10 hover:bg-navy/5"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold sm:text-base">
              Página final: {quiz.title}
            </p>
            <SaveIndicator state={saveState} />
          </div>
          <Link
            href={`/dashboard/quizzes/${quizId}/checkout`}
            className="hidden min-h-10 items-center gap-2 rounded-xl border border-navy/10 px-4 text-sm font-extrabold hover:bg-navy/5 sm:inline-flex"
          >
            <CircleDollarSign className="h-4 w-4" />
            Checkouts
          </Link>
          <button
            type="button"
            onClick={() => void saveChanges()}
            disabled={saveState === "saving"}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green px-4 text-sm font-extrabold disabled:opacity-60"
          >
            {saveState === "saving" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
        </header>

        <div className="sticky top-[73px] z-20 grid grid-cols-2 border-b border-navy/10 bg-white lg:hidden">
          {(["editor", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`min-h-11 border-b-2 text-xs font-extrabold ${
                mobileTab === tab
                  ? "border-green text-navy"
                  : "border-transparent text-navy/40"
              }`}
            >
              {tab === "editor" ? "Editor" : "Preview"}
            </button>
          ))}
        </div>

        <main className="grid min-h-[calc(100vh-73px)] lg:grid-cols-[minmax(520px,1fr)_minmax(420px,0.9fr)]">
          <section
            className={`${mobileTab === "editor" ? "block" : "hidden"} border-r border-navy/10 p-4 sm:p-6 lg:block lg:overflow-y-auto lg:p-8`}
          >
            <div className="mx-auto max-w-3xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black">Blocos da página</h1>
                  <p className="mt-1 text-sm text-navy/45">
                    Arraste para ordenar e clique para editar.
                  </p>
                </div>
                <BlockPicker
                  busy={busy}
                  onAdd={(type) => void addBlock(type)}
                />
              </div>

              {blocks.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-navy/15 bg-white p-8 text-center">
                  <MonitorSmartphone className="mx-auto h-10 w-10 text-navy/25" />
                  <h2 className="mt-4 font-extrabold">Sua página está vazia</h2>
                  <p className="mt-2 text-sm text-navy/45">
                    Adicione o primeiro bloco para começar.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <BlockPicker
                      busy={busy}
                      onAdd={(type) => void addBlock(type)}
                    />
                  </div>
                </div>
              ) : (
                <Droppable droppableId="final-blocks">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2"
                    >
                      {blocks.map((block, index) => (
                        <div key={block.id}>
                          <Draggable draggableId={block.id} index={index}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition ${
                                  selectedId === block.id
                                    ? "border-green ring-2 ring-green/15"
                                    : "border-navy/5"
                                } ${snapshot.isDragging ? "shadow-xl" : ""}`}
                              >
                                <button
                                  type="button"
                                  aria-label="Arrastar bloco"
                                  className="cursor-grab text-navy/25"
                                  {...dragProvided.dragHandleProps}
                                >
                                  <GripVertical className="h-5 w-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void selectBlock(block.id)}
                                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                >
                                  <BlockIcon type={block.type} />
                                  <div className="min-w-0">
                                    <p className="text-sm font-extrabold">
                                      {getBlockLabel(block.type)}
                                    </p>
                                    <p className="truncate text-xs text-navy/40">
                                      {getBlockSummary(block)}
                                    </p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(block)}
                                  className="rounded-lg p-2 text-navy/25 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Excluir bloco"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </Draggable>

                          <div className="relative flex h-7 items-center justify-center">
                            <button
                              type="button"
                              onClick={() =>
                                setAddAfterId((current) =>
                                  current === block.id ? null : block.id,
                                )
                              }
                              className="z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-navy/10 bg-white text-navy/40 shadow-sm hover:border-green hover:text-navy"
                              aria-label="Adicionar bloco aqui"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            {addAfterId === block.id && (
                              <div className="absolute left-1/2 top-7 z-20 grid w-[290px] -translate-x-1/2 grid-cols-2 gap-1 rounded-2xl border border-navy/10 bg-white p-2 shadow-xl">
                                {blockCatalog.map((item) => (
                                  <button
                                    key={item.type}
                                    type="button"
                                    onClick={() =>
                                      void addBlock(item.type, block.id)
                                    }
                                    className="flex items-center gap-2 rounded-xl p-2 text-left text-xs font-bold hover:bg-navy/5"
                                  >
                                    <item.icon className="h-4 w-4 text-green" />
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}

              {selectedBlock && (
                <div className="mt-8 rounded-3xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7">
                  <div className="mb-6 flex items-center gap-3">
                    <BlockIcon type={selectedBlock.type} />
                    <div>
                      <h2 className="font-black">
                        Editar {getBlockLabel(selectedBlock.type)}
                      </h2>
                      <p className="text-xs text-navy/40">
                        O preview é atualizado em tempo real.
                      </p>
                    </div>
                  </div>
                  <BlockEditor
                    block={selectedBlock}
                    variables={variables}
                    checkouts={checkouts}
                    imageUploading={busy === "image-upload"}
                    onContent={(patch) =>
                      patchBlock(selectedBlock.id, "content", patch)
                    }
                    onSettings={(patch) =>
                      patchBlock(selectedBlock.id, "settings", patch)
                    }
                    onUploadImage={uploadImage}
                  />
                </div>
              )}
            </div>
          </section>

          <aside
            className={`${mobileTab === "preview" ? "block" : "hidden"} bg-[#E9EDF1] p-4 sm:p-6 lg:block lg:overflow-y-auto lg:p-8`}
          >
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-black">Preview</h2>
                  <p className="text-xs text-navy/40">Dados de exemplo</p>
                </div>
                <div className="flex rounded-xl border border-navy/10 bg-white p-1">
                  <PreviewButton
                    active={previewMode === "desktop"}
                    label="Desktop"
                    icon={Laptop}
                    onClick={() => setPreviewMode("desktop")}
                  />
                  <PreviewButton
                    active={previewMode === "mobile"}
                    label="Mobile"
                    icon={Smartphone}
                    onClick={() => setPreviewMode("mobile")}
                  />
                </div>
              </div>

              <div
                className={`mx-auto overflow-hidden rounded-[28px] border border-navy/10 bg-white shadow-xl transition-all ${
                  previewMode === "mobile" ? "max-w-[390px]" : "max-w-3xl"
                }`}
              >
                <div
                  className="min-h-[650px] px-5 py-10 sm:px-8"
                  style={{ backgroundColor }}
                >
                  {blocks.length ? (
                    <FinalPageRenderer
                      blocks={blocks}
                      variables={previewVariables}
                      primaryColor={primaryColor}
                      backgroundColor={backgroundColor}
                      logoUrl={logoUrl}
                      quizTitle={quiz.title}
                      compact={previewMode === "mobile"}
                      onCtaClick={() => toast.info("Link aberto no quiz publicado.")}
                      onCheckoutClick={() =>
                        toast.info("Checkout preenchido no quiz publicado.")
                      }
                    />
                  ) : (
                    <div className="flex min-h-[500px] items-center justify-center text-center text-sm font-bold text-navy/30">
                      Adicione blocos para visualizar a página.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </main>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Excluir bloco?"
          description="Esta ação remove o bloco da página final."
          confirmLabel="Excluir bloco"
          loading={Boolean(deleteTarget && busy === deleteTarget.id)}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    </DragDropContext>
  );
}

function BlockEditor({
  block,
  variables,
  checkouts,
  imageUploading,
  onContent,
  onSettings,
  onUploadImage,
}: {
  block: FinalPageBlock;
  variables: string[];
  checkouts: CheckoutConfig[];
  imageUploading: boolean;
  onContent: (patch: Record<string, unknown>) => void;
  onSettings: (patch: Record<string, unknown>) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  if (
    block.type === "title" ||
    block.type === "subtitle" ||
    block.type === "paragraph"
  ) {
    return (
      <div className="space-y-5">
        <VariableField
          label="Texto"
          multiline
          value={getString(block.content.text)}
          variables={variables}
          onChange={(text) => onContent({ text })}
        />
        <AlignmentField
          value={getAlign(block.settings.align)}
          onChange={(align) => onSettings({ align })}
        />
        <ColorField
          label="Cor do texto"
          value={getString(block.settings.color) || "#0F1F3D"}
          onChange={(color) => onSettings({ color })}
        />
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-extrabold text-navy/55">
            Upload da imagem
          </span>
          <span className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-navy/20 text-sm font-bold hover:border-green">
            {imageUploading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {imageUploading ? "Enviando..." : "Escolher imagem"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={onUploadImage}
            disabled={imageUploading}
            className="hidden"
          />
        </label>
        <TextField
          label="URL da imagem"
          value={getString(block.content.url)}
          onChange={(url) => onContent({ url })}
          placeholder="https://..."
        />
        <VariableField
          label="Texto alternativo"
          value={getString(block.content.alt)}
          variables={variables}
          onChange={(alt) => onContent({ alt })}
        />
        <SelectField
          label="Largura"
          value={getString(block.settings.width) || "full"}
          onChange={(width) => onSettings({ width })}
          options={[
            { value: "full", label: "Largura total" },
            { value: "medium", label: "Média" },
          ]}
        />
        <RangeField
          label="Arredondamento"
          value={getNumber(block.settings.radius, 16)}
          min={0}
          max={40}
          suffix="px"
          onChange={(radius) => onSettings({ radius })}
        />
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <TextField
        label="URL do YouTube ou Vimeo"
        value={getString(block.content.url)}
        onChange={(url) => onContent({ url })}
        placeholder="https://youtube.com/watch?v=..."
      />
    );
  }

  if (block.type === "bullets") {
    return (
      <VariableField
        label="Itens, um por linha"
        multiline
        value={getStringArray(block.content.items).join("\n")}
        variables={variables}
        onChange={(value) =>
          onContent({
            items: value.split("\n").filter((item) => item.trim().length > 0),
          })
        }
      />
    );
  }

  if (block.type === "testimonial") {
    return (
      <div className="space-y-5">
        <VariableField
          label="Depoimento"
          multiline
          value={getString(block.content.text)}
          variables={variables}
          onChange={(text) => onContent({ text })}
        />
        <TextField
          label="Nome"
          value={getString(block.content.name)}
          onChange={(name) => onContent({ name })}
        />
        <TextField
          label="Cargo ou identificação"
          value={getString(block.content.role)}
          onChange={(role) => onContent({ role })}
        />
        <TextField
          label="URL da foto"
          value={getString(block.content.photoUrl)}
          onChange={(photoUrl) => onContent({ photoUrl })}
          placeholder="https://..."
        />
        <ColorField
          label="Fundo"
          value={getString(block.settings.backgroundColor) || "#F8FAFC"}
          onChange={(backgroundColor) => onSettings({ backgroundColor })}
        />
      </div>
    );
  }

  if (block.type === "cta_button") {
    return (
      <div className="space-y-5">
        <VariableField
          label="Texto do botão"
          value={getString(block.content.text)}
          variables={variables}
          onChange={(text) => onContent({ text })}
        />
        <VariableField
          label="URL de destino"
          value={getString(block.content.url)}
          variables={variables}
          onChange={(url) => onContent({ url })}
          placeholder="https://exemplo.com/oferta?nome={{name}}"
        />
        <ButtonStyleFields block={block} onSettings={onSettings} />
        <AlignmentField
          value={getAlign(block.settings.align)}
          onChange={(align) => onSettings({ align })}
        />
      </div>
    );
  }

  if (block.type === "checkout_button") {
    return (
      <div className="space-y-5">
        <VariableField
          label="Texto do botão"
          value={getString(block.content.text)}
          variables={variables}
          onChange={(text) => onContent({ text })}
        />
        <SelectField
          label="Checkout"
          value={getString(block.content.checkoutId)}
          onChange={(checkoutId) =>
            onContent({ checkoutId: checkoutId || null })
          }
          options={[
            { value: "", label: "Primeiro checkout ativo" },
            ...checkouts.map((checkout) => ({
              value: checkout.id,
              label: `${checkout.provider.toUpperCase()} - ${checkout.checkoutUrl}`,
            })),
          ]}
        />
        {checkouts.length === 0 && (
          <Link
            href={`/dashboard/quizzes/${block.quizId}/checkout`}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#087A5B]"
          >
            <Plus className="h-4 w-4" />
            Configurar um checkout
          </Link>
        )}
        <ButtonStyleFields block={block} onSettings={onSettings} />
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <div className="space-y-5">
        <ColorField
          label="Cor"
          value={getString(block.settings.color) || "#E2E8F0"}
          onChange={(color) => onSettings({ color })}
        />
        <RangeField
          label="Espessura"
          value={getNumber(block.settings.thickness, 1)}
          min={1}
          max={8}
          suffix="px"
          onChange={(thickness) => onSettings({ thickness })}
        />
      </div>
    );
  }

  return (
    <RangeField
      label="Altura do espaço"
      value={getNumber(block.settings.height, 32)}
      min={8}
      max={160}
      suffix="px"
      onChange={(height) => onSettings({ height })}
    />
  );
}

function ButtonStyleFields({
  block,
  onSettings,
}: {
  block: FinalPageBlock;
  onSettings: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ColorField
        label="Cor do botão"
        value={getString(block.settings.color) || "#00C48C"}
        onChange={(color) => onSettings({ color })}
      />
      <ColorField
        label="Cor do texto"
        value={getString(block.settings.textColor) || "#0F1F3D"}
        onChange={(textColor) => onSettings({ textColor })}
      />
    </div>
  );
}

function VariableField({
  label,
  value,
  variables,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  variables: string[];
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const openIndex = value.lastIndexOf("{{");
  const showSuggestions =
    openIndex >= 0 && openIndex > value.lastIndexOf("}}");
  const partial = showSuggestions ? value.slice(openIndex + 2).toLowerCase() : "";
  const suggestions = variables.filter((variable) =>
    variable.toLowerCase().includes(partial),
  );

  function insertVariable(variable: string) {
    onChange(`${value.slice(0, openIndex)}{{${variable}}}`);
  }

  return (
    <label className="relative block">
      <span className="mb-2 block text-xs font-extrabold text-navy/55">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className={fieldClassName}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={fieldClassName}
        />
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 flex max-h-40 w-full flex-wrap gap-1 overflow-y-auto rounded-xl border border-navy/10 bg-white p-2 shadow-xl">
          {suggestions.map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => insertVariable(variable)}
              className="rounded-lg bg-green/10 px-2.5 py-1.5 text-xs font-extrabold text-[#087A5B] hover:bg-green/20"
            >
              {`{{${variable}}}`}
            </button>
          ))}
        </div>
      )}
      <span className="mt-1.5 block text-[11px] text-navy/35">
        Digite {"{{"} para inserir uma variável.
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-navy/55">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={fieldClassName}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-navy/55">
        {label}
      </span>
      <span className="flex min-h-12 items-center gap-3 rounded-xl border border-navy/10 bg-white px-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-9 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold uppercase outline-none"
        />
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-navy/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
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

function AlignmentField({
  value,
  onChange,
}: {
  value: "left" | "center" | "right";
  onChange: (value: "left" | "center" | "right") => void;
}) {
  const options: Array<{
    value: "left" | "center" | "right";
    icon: LucideIcon;
  }> = [
    { value: "left", icon: AlignLeft },
    { value: "center", icon: AlignCenter },
    { value: "right", icon: AlignRight },
  ];

  return (
    <div>
      <span className="mb-2 block text-xs font-extrabold text-navy/55">
        Alinhamento
      </span>
      <div className="inline-flex rounded-xl border border-navy/10 bg-white p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg p-2.5 ${
              value === option.value ? "bg-green text-navy" : "text-navy/35"
            }`}
          >
            <option.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-xs font-extrabold text-navy/55">
        {label}
        <strong className="text-navy">
          {value}
          {suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#00C48C]"
      />
    </label>
  );
}

function BlockPicker({
  busy,
  onAdd,
}: {
  busy: string | null;
  onAdd: (type: FinalPageBlockType) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green px-4 text-sm font-extrabold"
      >
        <Plus className="h-4 w-4" />
        Adicionar bloco
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 grid w-[310px] grid-cols-2 gap-1 rounded-2xl border border-navy/10 bg-white p-2 shadow-xl">
          {blockCatalog.map((item) => (
            <button
              key={item.type}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                setOpen(false);
                onAdd(item.type);
              }}
              className="flex items-center gap-2 rounded-xl p-2.5 text-left text-xs font-bold hover:bg-navy/5 disabled:opacity-50"
            >
              <item.icon className="h-4 w-4 text-green" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockIcon({ type }: { type: FinalPageBlockType }) {
  const Icon =
    blockCatalog.find((item) => item.type === type)?.icon ?? MonitorSmartphone;

  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green/10 text-[#087A5B]">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function PreviewButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`rounded-lg p-2 ${
        active ? "bg-navy text-white" : "text-navy/35"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const details = {
    saved: { label: "Salvo", icon: Check, className: "text-[#087A5B]" },
    dirty: {
      label: "Alterações não salvas",
      icon: Save,
      className: "text-amber-600",
    },
    saving: {
      label: "Salvando...",
      icon: LoaderCircle,
      className: "text-navy/45",
    },
  }[state];
  const Icon = details.icon;

  return (
    <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-bold ${details.className}`}>
      <Icon className={`h-3 w-3 ${state === "saving" ? "animate-spin" : ""}`} />
      {details.label}
    </p>
  );
}

function FullPageLoading({
  label,
  spinning = true,
}: {
  label: string;
  spinning?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
      <div className="text-center">
        {spinning && (
          <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-green" />
        )}
        <p className="mt-3 text-sm font-bold text-navy/45">{label}</p>
      </div>
    </main>
  );
}

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-navy/10 bg-white px-3.5 py-3 text-sm font-semibold text-navy outline-none placeholder:text-navy/25 focus:border-green focus:ring-4 focus:ring-green/10";

function getBlockLabel(type: FinalPageBlockType): string {
  return blockCatalog.find((item) => item.type === type)?.label ?? type;
}

function getBlockSummary(block: FinalPageBlock): string {
  if (block.type === "bullets") {
    return getStringArray(block.content.items).join(" • ") || "Lista vazia";
  }
  if (block.type === "image" || block.type === "video") {
    return getString(block.content.url) || "Ainda não configurado";
  }
  if (block.type === "testimonial") {
    return getString(block.content.name) || "Depoimento";
  }
  if (block.type === "divider") {
    return "Linha divisória";
  }
  if (block.type === "spacer") {
    return `${getNumber(block.settings.height, 32)}px`;
  }

  return getString(block.content.text) || "Sem texto";
}

function getSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return typeof settings[key] === "string" ? String(settings[key]) : fallback;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getAlign(value: unknown): "left" | "center" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const result = [...items];
  const [removed] = result.splice(from, 1);

  if (removed !== undefined) {
    result.splice(to, 0, removed);
  }

  return result;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}
