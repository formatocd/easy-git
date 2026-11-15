import { useState, useEffect, useCallback, useRef } from "react";
import { open, ask } from "@tauri-apps/plugin-dialog";
import {
  openRepository,
  getCommitGraph,
  getBranches,
  getCommitFiles,
  getCommitFileDiff,
  getRemotes,
  getAheadBehind,
  fetchRemote,
  checkoutBranch,
  deleteBranch,
  deleteRemoteBranch,
  abortMerge,
  discardAllChanges,
  getStashes,
  stashApply,
  stashPop,
  stashDrop,
  getStashFiles,
  getStashFileDiff,
  getTags,
  deleteTag,
  deleteRemoteTag,
  pushTag,
  checkoutCommit,
  cherryPickCommit,
  revertCommit,
  resetToCommit,
  MergeResult,
  RepoSummary,
  CommitWithGraph,
  Branch,
  FileChange,
  RemoteInfo,
  AheadBehind,
  StashEntry,
  TagInfo,
} from "./api/git";
import { GraphCell } from "./components/GraphCell";
import { DiffViewer } from "./components/DiffViewer";
import { FileTree } from "./components/FileTree";
import { WorkingCopyView } from "./components/WorkingCopyView";
import { BranchTree } from "./components/BranchTree";
import { PullModal } from "./components/PullModal";
import { PushModal } from "./components/PushModal";
import { ManageRemotesModal } from "./components/ManageRemotesModal";
import { CreateBranchModal } from "./components/CreateBranchModal";
import { CheckoutRemoteModal } from "./components/CheckoutRemoteModal";
import { MergeModal } from "./components/MergeModal";
import { ErrorModal } from "./components/ErrorModal";
import { ConfirmCheckoutModal } from "./components/ConfirmCheckoutModal";
import { StashModal } from "./components/StashModal";
import { StashList } from "./components/StashList";
import { CreateTagModal } from "./components/CreateTagModal";
import { TagList } from "./components/TagList";
import { DeleteTagModal } from "./components/DeleteTagModal";
import { OperationModal, OperationModalState } from "./components/OperationModal";
import { ResetCommitModal } from "./components/ResetCommitModal";
import {
  FolderOpen,
  GitBranch,
  GitCommit,
  GitPullRequest,
  ArrowDown,
  ArrowUp,
  Archive,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Tag,
  Clock,
  User,
  FileDiff,
  Layers,
  Copy,
  Cloud,
  RefreshCw,
  Plus,
  Play,
  Trash2,
  Undo2,
} from "./components/Icons";
import "./App.css";

function App() {
  const [repoPath, setRepoPath] = useState("");
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<CommitWithGraph[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitWithGraph | null>(null);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [aheadBehind, setAheadBehind] = useState<AheadBehind>({ ahead: 0, behind: 0 });
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);

  // Modals & Remote Operations State
  const [isPullOpen, setIsPullOpen] = useState(false);
  const [isPushOpen, setIsPushOpen] = useState(false);
  const [isManageRemotesOpen, setIsManageRemotesOpen] = useState(false);
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [tagTargetHash, setTagTargetHash] = useState<string | null>(null);
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<TagInfo | null>(null);
  const [branchBaseCommit, setBranchBaseCommit] = useState<CommitWithGraph | null>(null);
  const [branchBaseOption, setBranchBaseOption] = useState<"head" | "commit">("head");
  const [resetTargetCommit, setResetTargetCommit] = useState<CommitWithGraph | null>(null);
  const [commitContextMenu, setCommitContextMenu] = useState<{
    x: number;
    y: number;
    commit: CommitWithGraph;
  } | null>(null);
  const [mergeSourceBranch, setMergeSourceBranch] = useState<string | null>(null);
  const [isAbortingMerge, setIsAbortingMerge] = useState(false);
  const [checkoutRemoteTarget, setCheckoutRemoteTarget] = useState<Branch | null>(null);
  const [confirmCheckoutTarget, setConfirmCheckoutTarget] = useState<Branch | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [operationModal, setOperationModal] = useState<OperationModalState | null>(null);

  const showError = useCallback((title: string, message: string) => {
    setErrorModal({ title, message });
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" = "success", duration = 3500) => {
    setFetchToast({ message, type });
    setTimeout(() => setFetchToast(null), duration);
  }, []);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchToast, setFetchToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  // Active view: "history" (Commit DAG), "working_copy" (Staging & Commit), or "stash" (Stash preview)
  const [activeView, setActiveView] = useState<"history" | "working_copy" | "stash">("history");

  // File changes & Diff state for History View
  const [commitFiles, setCommitFiles] = useState<FileChange[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Stash preview state
  const [selectedStash, setSelectedStash] = useState<StashEntry | null>(null);
  const [stashFiles, setStashFiles] = useState<FileChange[]>([]);
  const [selectedStashFile, setSelectedStashFile] = useState<FileChange | null>(null);
  const [stashDiffText, setStashDiffText] = useState<string | null>(null);
  const [loadingStashFiles, setLoadingStashFiles] = useState(false);
  const [loadingStashDiff, setLoadingStashDiff] = useState(false);
  const [isStashOperating, setIsStashOperating] = useState(false);

  // Resizable panel sizes configured to match the user's layout by default:
  // - bottomHeightPercent: 50% (50/50 vertical split between commits table and bottom panels)
  // - fileListPercent: 42% (horizontal split: left column for commit info/files vs right for diff viewer)
  // - commitInfoPercent: 40% (vertical split inside left column: commit info vs file tree)
  const [bottomHeightPercent, setBottomHeightPercent] = useState<number>(50);
  const [fileListPercent, setFileListPercent] = useState<number>(42);
  const [commitInfoPercent, setCommitInfoPercent] = useState<number>(40);
  const [copiedHash, setCopiedHash] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatDate(timestamp: number) {
    if (!timestamp) return "—";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function loadRepository(path: string) {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const repoSummary = await openRepository(path);
      const [repoBranches, repoCommits, repoRemotes, ab, repoStashes, repoTags] = await Promise.all([
        getBranches(path),
        getCommitGraph(path, 100),
        getRemotes(path).catch(() => []),
        getAheadBehind(path).catch(() => ({ ahead: 0, behind: 0 })),
        getStashes(path).catch(() => []),
        getTags(path).catch(() => []),
      ]);

      setSummary(repoSummary);
      setBranches(repoBranches);
      setCommits(repoCommits);
      setRemotes(repoRemotes);
      setAheadBehind(ab);
      setStashes(repoStashes);
      setTags(repoTags);
      setSelectedTagName(null);
      setSelectedStash(null);
      setStashFiles([]);
      setSelectedStashFile(null);
      setStashDiffText(null);
      setRepoPath(path);

      if (repoCommits.length > 0) {
        const firstRealCommit = repoCommits.find((c) => c.hash !== "uncommitted") || null;
        setSelectedCommit(firstRealCommit);
      } else {
        setSelectedCommit(null);
        setCommitFiles([]);
        setSelectedFile(null);
        setDiffText(null);
      }
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select a Git repository",
      });

      if (selected && typeof selected === "string") {
        await loadRepository(selected);
      }
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    }
  }

  // When a commit is selected in History, load its changed files
  useEffect(() => {
    if (!selectedCommit || !repoPath) {
      setCommitFiles([]);
      setSelectedFile(null);
      setDiffText(null);
      return;
    }

    let isCancelled = false;
    async function fetchFiles() {
      setLoadingFiles(true);
      try {
        const parent = selectedCommit?.parents[0] || null;
        const files = await getCommitFiles(repoPath, selectedCommit!.hash, parent);
        if (!isCancelled) {
          setCommitFiles(files);
          if (files.length > 0) {
            setSelectedFile(files[0]);
          } else {
            setSelectedFile(null);
            setDiffText(null);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading commit files:", err);
          setCommitFiles([]);
          setSelectedFile(null);
          setDiffText(null);
        }
      } finally {
        if (!isCancelled) setLoadingFiles(false);
      }
    }

    fetchFiles();
    return () => {
      isCancelled = true;
    };
  }, [selectedCommit?.hash, repoPath]);

  // When a file is selected in History, load its diff
  useEffect(() => {
    if (!selectedCommit || !selectedFile || !repoPath) {
      setDiffText(null);
      return;
    }

    let isCancelled = false;
    async function fetchDiff() {
      setLoadingDiff(true);
      try {
        const parent = selectedCommit?.parents[0] || null;
        const diff = await getCommitFileDiff(
          repoPath,
          selectedCommit!.hash,
          selectedFile!.path,
          parent,
        );
        if (!isCancelled) {
          setDiffText(diff);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading diff:", err);
          setDiffText("Error loading file diff.");
        }
      } finally {
        if (!isCancelled) setLoadingDiff(false);
      }
    }

    fetchDiff();
    return () => {
      isCancelled = true;
    };
  }, [selectedCommit?.hash, selectedFile?.path, repoPath]);

  // When a stash is selected, load its changed files
  useEffect(() => {
    if (!selectedStash || !repoPath) {
      setStashFiles([]);
      setSelectedStashFile(null);
      setStashDiffText(null);
      return;
    }

    let isCancelled = false;
    async function fetchStashFiles() {
      setLoadingStashFiles(true);
      try {
        const files = await getStashFiles(repoPath, selectedStash!.reference);
        if (!isCancelled) {
          setStashFiles(files);
          if (files.length > 0) {
            setSelectedStashFile(files[0]);
          } else {
            setSelectedStashFile(null);
            setStashDiffText(null);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading stash files:", err);
          setStashFiles([]);
          setSelectedStashFile(null);
          setStashDiffText(null);
        }
      } finally {
        if (!isCancelled) setLoadingStashFiles(false);
      }
    }

    fetchStashFiles();
    return () => {
      isCancelled = true;
    };
  }, [selectedStash?.reference, selectedStash?.hash, repoPath]);

  // When a file is selected inside Stash preview, load its diff
  useEffect(() => {
    if (!selectedStash || !selectedStashFile || !repoPath) {
      setStashDiffText(null);
      return;
    }

    let isCancelled = false;
    async function fetchStashDiff() {
      setLoadingStashDiff(true);
      try {
        const diff = await getStashFileDiff(
          repoPath,
          selectedStash!.reference,
          selectedStashFile!.path,
        );
        if (!isCancelled) {
          setStashDiffText(diff);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading stash diff:", err);
          setStashDiffText("Error loading stash file diff.");
        }
      } finally {
        if (!isCancelled) setLoadingStashDiff(false);
      }
    }

    fetchStashDiff();
    return () => {
      isCancelled = true;
    };
  }, [selectedStash?.reference, selectedStash?.hash, selectedStashFile?.path, repoPath]);

  // Load current repository initially
  useEffect(() => {
    loadRepository("D:\\Usuarios\\Carlos\\Proyectos\\Rust\\git_client");
  }, []);

  const refreshAll = useCallback(async (force = false) => {
    if (!repoPath) return;
    if (inFlightRefreshRef.current) {
      if (!force) {
        return inFlightRefreshRef.current;
      }
      await inFlightRefreshRef.current;
    }

    const promise = (async () => {
      try {
        const [repoSummary, repoBranches, repoCommits, repoRemotes, ab, repoStashes, repoTags] = await Promise.all([
          openRepository(repoPath),
          getBranches(repoPath),
          getCommitGraph(repoPath, 100),
          getRemotes(repoPath).catch(() => []),
          getAheadBehind(repoPath).catch(() => ({ ahead: 0, behind: 0 })),
          getStashes(repoPath).catch(() => []),
          getTags(repoPath).catch(() => []),
        ]);

        setSummary(repoSummary);
        setBranches(repoBranches);
        setCommits(repoCommits);
        setRemotes(repoRemotes);
        setAheadBehind(ab);
        setStashes(repoStashes);
        setTags(repoTags);
        setRefreshKey((k) => k + 1);

        setSelectedStash((prev) => {
          if (!prev) return null;
          return repoStashes.find((s) => s.hash === prev.hash) || null;
        });

        setSelectedCommit((prev) => {
          if (!prev) {
            return repoCommits.find((c) => c.hash !== "uncommitted") || null;
          }
          const matching = repoCommits.find((c) => c.hash === prev.hash);
          return matching || repoCommits.find((c) => c.hash !== "uncommitted") || null;
        });
      } catch (err) {
        console.error("Auto-refresh error:", err);
      } finally {
        inFlightRefreshRef.current = null;
      }
    })();

    inFlightRefreshRef.current = promise;
    return promise;
  }, [repoPath]);

  // Auto-refresh when window regains focus, becomes visible, or periodically every 5 seconds
  useEffect(() => {
    if (!repoPath) return;

    const handleFocus = () => {
      refreshAll();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshAll();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(() => {
      refreshAll();
    }, 5000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [repoPath, refreshAll]);

  // When a commit finishes in WorkingCopyView, reload repo and show the graph
  const handleCommitSuccess = () => {
    refreshAll();
    setActiveView("history");
  };

  const handleSwitchToHistory = useCallback(() => {
    setActiveView("history");
    refreshAll();
  }, [refreshAll]);

  const runOperation = useCallback(
    async <T,>(options: {
      title: string;
      runningMessage: string;
      errorTitle: string;
      showResultModal?: boolean;
      successTitle?: string;
      getSuccessMessage?: (result: T) => string;
      getOutput?: (result: T) => string | undefined;
      action: () => Promise<T>;
    }): Promise<T | undefined> => {
      setOperationModal({
        status: "running",
        title: options.title,
        message: options.runningMessage,
      });

      try {
        const result = await options.action();
        await refreshAll(true);

        if (options.showResultModal) {
          setOperationModal({
            status: "success",
            title: options.successTitle || options.title,
            message: options.getSuccessMessage
              ? options.getSuccessMessage(result)
              : "Operation completed successfully.",
            output: options.getOutput ? options.getOutput(result) : undefined,
          });
        } else {
          setOperationModal(null);
          if (options.getSuccessMessage) {
            showToast(options.getSuccessMessage(result), "success");
          }
        }
        return result;
      } catch (err: unknown) {
        await refreshAll(true);
        setOperationModal(null);
        const msg = typeof err === "string" ? err : String(err);
        showError(options.errorTitle, msg);
        return undefined;
      }
    },
    [refreshAll, showError, showToast],
  );

  useEffect(() => {
    const closeMenu = () => setCommitContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCommitContextMenu(null);
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleOpenCreateTag = (explicitHash?: string | null) => {
    const target =
      explicitHash !== undefined
        ? explicitHash
        : selectedCommit && selectedCommit.hash !== "uncommitted"
        ? selectedCommit.hash
        : null;
    setTagTargetHash(target);
    setIsCreateTagOpen(true);
  };

  const handleCheckoutCommit = async (commit: CommitWithGraph) => {
    if (!repoPath) return;
    const confirmed = await ask(
      `Check out commit ${commit.short_hash} ("${commit.summary}")?\n\nThis will put your repository into a detached HEAD state.`,
      {
        title: "Checkout Commit",
        kind: "warning",
        okLabel: "Checkout",
        cancelLabel: "Cancel",
      },
    );
    if (!confirmed) return;

    await runOperation({
      title: "Checkout Commit",
      runningMessage: `Checking out commit ${commit.short_hash}...`,
      errorTitle: "Checkout Commit Error",
      showResultModal: false,
      getSuccessMessage: () => `Checked out commit ${commit.short_hash} (detached HEAD).`,
      action: () => checkoutCommit(repoPath, commit.hash),
    });
  };

  const handleCreateBranchFromCommit = (commit: CommitWithGraph) => {
    setBranchBaseCommit(commit);
    setBranchBaseOption("commit");
    setIsCreateBranchOpen(true);
  };

  const handleCherryPickCommit = async (commit: CommitWithGraph) => {
    if (!repoPath) return;
    const confirmed = await ask(
      `Cherry-pick commit ${commit.short_hash} ("${commit.summary}") onto '${summary?.current_branch || "HEAD"}'?`,
      {
        title: "Cherry-pick Commit",
        kind: "info",
        okLabel: "Cherry-pick",
        cancelLabel: "Cancel",
      },
    );
    if (!confirmed) return;

    const res = await runOperation({
      title: "Cherry-pick Commit",
      runningMessage: `Cherry-picking ${commit.short_hash}...`,
      errorTitle: "Cherry-pick Error",
      showResultModal: true,
      successTitle: "Cherry-pick Completed",
      getSuccessMessage: (r) =>
        r.status === "conflict"
          ? `Cherry-pick resulted in conflicts in ${r.conflicts.length} file(s). Please resolve them in File Status.`
          : `Cherry-picked ${commit.short_hash} successfully.`,
      getOutput: (r) => (r.status === "conflict" ? r.conflicts.join("\n") : r.message),
      action: () => cherryPickCommit(repoPath, commit.hash),
    });

    if (res?.status === "conflict") {
      setActiveView("working_copy");
    }
  };

  const handleRevertCommit = async (commit: CommitWithGraph) => {
    if (!repoPath) return;
    const confirmed = await ask(
      `Revert commit ${commit.short_hash} ("${commit.summary}")?\n\nThis will create a new commit that undoes the changes introduced by ${commit.short_hash}.`,
      {
        title: "Revert Commit",
        kind: "warning",
        okLabel: "Revert",
        cancelLabel: "Cancel",
      },
    );
    if (!confirmed) return;

    const res = await runOperation({
      title: "Revert Commit",
      runningMessage: `Reverting ${commit.short_hash}...`,
      errorTitle: "Revert Commit Error",
      showResultModal: true,
      successTitle: "Commit Reverted",
      getSuccessMessage: (r) =>
        r.status === "conflict"
          ? `Revert resulted in conflicts in ${r.conflicts.length} file(s). Please resolve them in File Status.`
          : `Reverted ${commit.short_hash} successfully.`,
      getOutput: (r) => (r.status === "conflict" ? r.conflicts.join("\n") : r.message),
      action: () => revertCommit(repoPath, commit.hash),
    });

    if (res?.status === "conflict") {
      setActiveView("working_copy");
    }
  };

  const handleConfirmResetCommit = async (
    commit: CommitWithGraph,
    mode: "soft" | "mixed" | "hard",
  ) => {
    if (!repoPath) return;
    await runOperation({
      title: "Reset Branch",
      runningMessage: `Resetting (${mode}) to ${commit.short_hash}...`,
      errorTitle: "Reset Error",
      showResultModal: true,
      successTitle: "Reset Completed",
      getSuccessMessage: () => `Branch reset (${mode}) to ${commit.short_hash}.`,
      getOutput: (out) => out,
      action: () => resetToCommit(repoPath, commit.hash, mode),
    });
  };

  const handleSelectTag = (tag: TagInfo) => {
    setSelectedTagName(tag.name);
    setActiveView("history");
    if (tag.target_hash) {
      const matchingCommit = commits.find(
        (c) =>
          c.hash === tag.target_hash ||
          c.hash.startsWith(tag.target_hash) ||
          tag.target_hash.startsWith(c.hash),
      );
      if (matchingCommit) {
        setSelectedCommit(matchingCommit);
      }
    }
  };

  const handlePushTag = async (tag: TagInfo, remote: string) => {
    if (!repoPath) return;
    await runOperation({
      title: "Push Tag",
      runningMessage: `Pushing tag '${tag.name}' to '${remote}'...`,
      errorTitle: "Push Tag Failed",
      showResultModal: true,
      successTitle: "Tag Pushed",
      getSuccessMessage: () => `Tag '${tag.name}' pushed to '${remote}' successfully.`,
      getOutput: (out) => out,
      action: () => pushTag(repoPath, remote, tag.name),
    });
  };

  const handleDeleteTag = (tag: TagInfo) => {
    if (!repoPath) return;
    setDeleteTagTarget(tag);
  };

  const handleConfirmDeleteTag = async (tag: TagInfo, remotesToDelete: string[]) => {
    if (!repoPath) return;
    const isRemote = remotesToDelete.length > 0;
    await runOperation({
      title: "Delete Tag",
      runningMessage: isRemote
        ? `Deleting tag '${tag.name}' locally and from ${remotesToDelete.join(", ")}...`
        : `Deleting local tag '${tag.name}'...`,
      errorTitle: "Delete Tag Failed",
      showResultModal: isRemote,
      successTitle: "Tag Deleted",
      getSuccessMessage: () =>
        isRemote
          ? `Deleted tag '${tag.name}' locally and from ${remotesToDelete.join(", ")}.`
          : `Deleted tag '${tag.name}'.`,
      getOutput: (out) => (isRemote ? out : undefined),
      action: async () => {
        const outputs: string[] = [];
        const localOut = await deleteTag(repoPath, tag.name);
        if (localOut) outputs.push(localOut);
        for (const remote of remotesToDelete) {
          const remoteOut = await deleteRemoteTag(repoPath, remote, tag.name);
          if (remoteOut) outputs.push(remoteOut);
        }
        if (selectedTagName === tag.name) {
          setSelectedTagName(null);
        }
        return outputs.join("\n");
      },
    });
  };

  const handleDeleteRemoteTag = async (tag: TagInfo, remote: string) => {
    if (!repoPath) return;
    const confirmed = await ask(
      `Are you sure you want to delete tag '${tag.name}' from remote '${remote}'?`,
      {
        title: "Delete Remote Tag",
        kind: "warning",
      },
    );
    if (!confirmed) return;

    await runOperation({
      title: "Delete Remote Tag",
      runningMessage: `Deleting tag '${tag.name}' from '${remote}'...`,
      errorTitle: "Delete Remote Tag Failed",
      showResultModal: true,
      successTitle: "Remote Tag Deleted",
      getSuccessMessage: () => `Deleted remote tag '${tag.name}' from '${remote}'.`,
      getOutput: (out) => out,
      action: () => deleteRemoteTag(repoPath, remote, tag.name),
    });
  };

  const handleSelectStash = (stash: StashEntry) => {
    setSelectedStash(stash);
    setActiveView("stash");
  };

  const handleApplyStash = async (stash: StashEntry) => {
    if (!repoPath || isStashOperating) return;
    setIsStashOperating(true);
    try {
      await runOperation({
        title: "Apply Stash",
        runningMessage: `Applying ${stash.reference}...`,
        errorTitle: "Apply Stash Failed",
        showResultModal: false,
        getSuccessMessage: () => `Applied ${stash.reference} successfully.`,
        action: () => stashApply(repoPath, stash.reference),
      });
    } finally {
      setIsStashOperating(false);
    }
  };

  const handlePopStash = async (stash: StashEntry) => {
    if (!repoPath || isStashOperating) return;
    setIsStashOperating(true);
    try {
      await runOperation({
        title: "Pop Stash",
        runningMessage: `Popping ${stash.reference}...`,
        errorTitle: "Pop Stash Failed",
        showResultModal: false,
        getSuccessMessage: () => `Popped ${stash.reference} successfully.`,
        action: async () => {
          const out = await stashPop(repoPath, stash.reference);
          if (selectedStash?.hash === stash.hash) {
            setSelectedStash(null);
            if (activeView === "stash") {
              setActiveView("history");
            }
          }
          return out;
        },
      });
    } finally {
      setIsStashOperating(false);
    }
  };

  const handleDropStash = async (stash: StashEntry) => {
    if (!repoPath || isStashOperating) return;
    const confirmed = await ask(
      `Are you sure you want to delete ${stash.reference} ("${stash.message}")?\n\nThis action cannot be undone.`,
      {
        title: "Delete Stash",
        kind: "warning",
      },
    );
    if (!confirmed) return;

    setIsStashOperating(true);
    try {
      await runOperation({
        title: "Delete Stash",
        runningMessage: `Deleting ${stash.reference}...`,
        errorTitle: "Delete Stash Failed",
        showResultModal: false,
        getSuccessMessage: () => `Deleted ${stash.reference}.`,
        action: async () => {
          const out = await stashDrop(repoPath, stash.reference);
          if (selectedStash?.hash === stash.hash) {
            setSelectedStash(null);
            if (activeView === "stash") {
              setActiveView("history");
            }
          }
          return out;
        },
      });
    } finally {
      setIsStashOperating(false);
    }
  };

  const handleFetch = async () => {
    if (!repoPath || isFetching) return;
    setIsFetching(true);
    setFetchToast(null);

    try {
      await runOperation({
        title: "Fetch Remotes",
        runningMessage: "Fetching branches and tags from all remotes...",
        errorTitle: "Fetch Error",
        showResultModal: true,
        successTitle: "Fetch Completed",
        getSuccessMessage: () => "Fetch completed successfully.",
        getOutput: (out) => out,
        action: () => fetchRemote(repoPath),
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleCheckoutLocalBranch = async (branch: Branch) => {
    if (branch.is_current || !repoPath) return;

    // If repo has uncommitted changes or an unresolved merge, prompt confirmation modal!
    if (summary && (!summary.is_clean || summary.is_merging)) {
      setConfirmCheckoutTarget(branch);
      return;
    }

    setOperationModal({
      status: "running",
      title: "Switch Branch",
      message: `Switching to branch '${branch.name}'...`,
    });
    try {
      await checkoutBranch(repoPath, branch.name);
      await refreshAll(true);
      setOperationModal(null);
      showToast(`Switched to branch '${branch.name}'.`, "success");
    } catch (err: unknown) {
      await refreshAll(true);
      setOperationModal(null);
      const msg = typeof err === "string" ? err : String(err);
      if (
        msg.toLowerCase().includes("overwritten by checkout") ||
        msg.toLowerCase().includes("local changes") ||
        msg.toLowerCase().includes("uncommitted")
      ) {
        setConfirmCheckoutTarget(branch);
      } else {
        showError("Checkout Branch Error", msg);
      }
    }
  };

  const handleConfirmCheckout = async (discardChanges: boolean) => {
    if (!confirmCheckoutTarget || !repoPath) return;
    const targetBranchName = confirmCheckoutTarget.name;
    setConfirmCheckoutTarget(null);

    await runOperation({
      title: "Switch Branch",
      runningMessage: discardChanges
        ? `Discarding uncommitted changes and switching to '${targetBranchName}'...`
        : `Switching to branch '${targetBranchName}'...`,
      errorTitle: "Checkout Branch Error",
      showResultModal: false,
      getSuccessMessage: () => `Switched to branch '${targetBranchName}'.`,
      action: async () => {
        if (discardChanges) {
          await discardAllChanges(repoPath);
        }
        await checkoutBranch(repoPath, targetBranchName);
      },
    });
  };

  const handleCheckoutRemoteBranch = (branch: Branch) => {
    setCheckoutRemoteTarget(branch);
  };

  const handleDeleteLocalBranch = async (branch: Branch) => {
    if (branch.is_current || !repoPath) return;
    try {
      const confirmed = await ask(
        `Are you sure you want to delete local branch '${branch.name}'?`,
        {
          title: "Delete Local Branch",
          kind: "warning",
          okLabel: "Delete Branch",
          cancelLabel: "Cancel",
        }
      );
      if (!confirmed) return;

      setOperationModal({
        status: "running",
        title: "Delete Branch",
        message: `Deleting local branch '${branch.name}'...`,
      });

      try {
        await deleteBranch(repoPath, branch.name, false);
      } catch (err: unknown) {
        const errMsg = typeof err === "string" ? err : String(err);
        if (errMsg.toLowerCase().includes("not fully merged") || errMsg.toLowerCase().includes("-d")) {
          setOperationModal(null);
          const forceConfirmed = await ask(
            `Branch '${branch.name}' is not fully merged.\n\nDo you want to force delete it (git branch -D)?`,
            {
              title: "Force Delete Branch",
              kind: "warning",
              okLabel: "Force Delete",
              cancelLabel: "Cancel",
            }
          );
          if (forceConfirmed) {
            setOperationModal({
              status: "running",
              title: "Force Delete Branch",
              message: `Force deleting local branch '${branch.name}'...`,
            });
            await deleteBranch(repoPath, branch.name, true);
          } else {
            return;
          }
        } else {
          throw err;
        }
      }

      await refreshAll(true);
      setOperationModal(null);
      showToast(`Branch '${branch.name}' deleted.`, "success");
    } catch (err: unknown) {
      await refreshAll(true);
      setOperationModal(null);
      const msg = typeof err === "string" ? err : String(err);
      showError("Delete Branch Error", msg);
    }
  };

  const handleDeleteRemoteBranch = async (branch: Branch) => {
    if (!repoPath) return;
    const slashIdx = branch.name.indexOf("/");
    if (slashIdx === -1) {
      showError("Delete Remote Branch Error", `Invalid remote branch format: ${branch.name}`);
      return;
    }
    const remoteName = branch.name.slice(0, slashIdx);
    const remoteBranchName = branch.name.slice(slashIdx + 1);

    const confirmed = await ask(
      `Are you sure you want to delete remote branch '${remoteBranchName}' from remote '${remoteName}'?\n\nThis will permanently delete the branch from the remote server.`,
      {
        title: "Delete Remote Branch",
        kind: "warning",
        okLabel: "Delete on Remote",
        cancelLabel: "Cancel",
      }
    );
    if (!confirmed) return;

    await runOperation({
      title: "Delete Remote Branch",
      runningMessage: `Deleting '${remoteBranchName}' from remote '${remoteName}'...`,
      errorTitle: "Delete Remote Branch Error",
      showResultModal: true,
      successTitle: "Remote Branch Deleted",
      getSuccessMessage: () => `Remote branch '${remoteBranchName}' deleted from '${remoteName}'.`,
      getOutput: (out) => out,
      action: () => deleteRemoteBranch(repoPath, remoteName, remoteBranchName),
    });
  };

  const handleOpenMerge = (sourceBranch?: string) => {
    setMergeSourceBranch(sourceBranch || null);
    setIsMergeOpen(true);
  };

  const handleMergeSuccess = async (result: MergeResult) => {
    await refreshAll();
    if (result.status === "success") {
      setOperationModal({
        status: "success",
        title: "Merge Completed",
        message: "Merge completed successfully.",
        output: result.message,
      });
    } else if (result.status === "already_up_to_date") {
      setOperationModal({
        status: "success",
        title: "Merge Up to Date",
        message: "Already up to date. No changes to merge.",
        output: result.message,
      });
    } else if (result.status === "conflict") {
      setActiveView("working_copy");
      setOperationModal({
        status: "success",
        title: "Merge Conflicts Detected",
        message: `Merge conflict in ${result.conflicts.length} file(s). Please resolve conflicts in File Status or abort the merge.`,
        output: result.conflicts.join("\n"),
      });
    }
  };

  const handleAbortMerge = async () => {
    if (!repoPath || isAbortingMerge) return;
    const confirmed = await ask(
      "Are you sure you want to abort the current merge?\n\nAll unresolved merge changes will be discarded.",
      {
        title: "Abort Merge",
        kind: "warning",
        okLabel: "Abort Merge",
        cancelLabel: "Cancel",
      }
    );
    if (!confirmed) return;

    setIsAbortingMerge(true);
    try {
      await runOperation({
        title: "Abort Merge",
        runningMessage: "Aborting merge and restoring working tree...",
        errorTitle: "Abort Merge Error",
        showResultModal: true,
        successTitle: "Merge Aborted",
        getSuccessMessage: () => "Merge aborted cleanly.",
        getOutput: (out) => out,
        action: () => abortMerge(repoPath),
      });
    } finally {
      setIsAbortingMerge(false);
    }
  };

  // Drag handlers for resizable panels in History view
  const handleVerticalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPercent = bottomHeightPercent;
    const parentEl = (e.currentTarget.parentElement as HTMLElement);
    const totalHeight = parentEl ? parentEl.clientHeight : (window.innerHeight - 50);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const deltaPercent = (deltaY / totalHeight) * 100;
      const newPercent = Math.max(15, Math.min(85, startPercent + deltaPercent));
      setBottomHeightPercent(newPercent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [bottomHeightPercent]);

  const handleHorizontalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPercent = fileListPercent;
    const parentEl = (e.currentTarget.parentElement as HTMLElement);
    const totalWidth = parentEl ? parentEl.clientWidth : (window.innerWidth - 224);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / totalWidth) * 100;
      const newPercent = Math.max(20, Math.min(75, startPercent + deltaPercent));
      setFileListPercent(newPercent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [fileListPercent]);

  const handleCommitInfoResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPercent = commitInfoPercent;
    const parentEl = (e.currentTarget.parentElement as HTMLElement);
    const totalHeight = parentEl ? parentEl.clientHeight : 300;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPercent = (deltaY / totalHeight) * 100;
      const newPercent = Math.max(15, Math.min(85, startPercent + deltaPercent));
      setCommitInfoPercent(newPercent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [commitInfoPercent]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleSelectBranch = useCallback(
    (branch: Branch) => {
      setActiveView("history");
      if (branch.target_hash) {
        const matchingCommit = commits.find(
          (c) =>
            c.hash === branch.target_hash ||
            c.hash.startsWith(branch.target_hash) ||
            branch.target_hash.startsWith(c.hash)
        );
        if (matchingCommit) {
          setSelectedCommit(matchingCommit);
        }
      }
    },
    [commits]
  );

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#18181b] text-zinc-100 select-none overflow-hidden font-sans">
      {/* 1. TOP TOOLBAR */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#202023] border-b border-zinc-800 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 mr-4">
            <span className="text-xl">🦀</span>
            <span className="font-bold text-base tracking-tight text-white">easy-git</span>
          </div>

          <button
            onClick={handleSelectFolder}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded transition cursor-pointer"
          >
            <FolderOpen size={15} className="text-sky-400" />
            <span>Open Repo</span>
          </button>

          <div className="h-4 w-px bg-zinc-700 mx-1" />

          {/* Action buttons */}
          <button
            onClick={() => setActiveView("working_copy")}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs transition cursor-pointer ${
              activeView === "working_copy"
                ? "bg-emerald-600/30 text-emerald-300 font-semibold border border-emerald-500/50"
                : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <GitCommit size={14} className="text-emerald-400" />
            <span>Commit</span>
          </button>

          {/* Pull */}
          <button
            onClick={() => setIsPullOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Pull changes from remote"
          >
            <ArrowDown size={14} className="text-blue-400" />
            <span>Pull</span>
            {aheadBehind.behind > 0 && (
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {aheadBehind.behind}
              </span>
            )}
          </button>

          {/* Push */}
          <button
            onClick={() => setIsPushOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Push changes to remote"
          >
            <ArrowUp size={14} className="text-amber-400" />
            <span>Push</span>
            {aheadBehind.ahead > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {aheadBehind.ahead}
              </span>
            )}
          </button>

          {/* Fetch */}
          <button
            onClick={handleFetch}
            disabled={isFetching}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer disabled:opacity-60"
            title="Fetch all branches and tags from remotes"
          >
            <RefreshCw size={13} className={`text-sky-400 ${isFetching ? "animate-spin" : ""}`} />
            <span>Fetch</span>
          </button>
          <button
            onClick={() => setIsCreateBranchOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Create new branch"
          >
            <GitBranch size={14} className="text-purple-400" />
            <span>Branch</span>
          </button>
          <button
            onClick={() => handleOpenMerge()}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Merge branch into current branch"
          >
            <GitPullRequest size={14} className="text-pink-400" />
            <span>Merge</span>
          </button>
          <button
            onClick={() => setIsStashModalOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Stash uncommitted changes"
          >
            <Archive size={14} className="text-orange-400" />
            <span>Stash</span>
          </button>
          <button
            onClick={() => handleOpenCreateTag()}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Create tag on selected commit"
          >
            <Tag size={14} className="text-amber-400" />
            <span>Tag</span>
          </button>
        </div>

        {summary && (
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 text-zinc-400">
              <span className="font-semibold text-zinc-200">{summary.name}</span>
            </div>
            <div className="flex items-center space-x-1 bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700">
              <GitBranch size={13} className="text-sky-400" />
              <span className="text-sky-300 font-medium">{summary.current_branch || "HEAD"}</span>
            </div>
            <div
              onClick={() => setActiveView("working_copy")}
              className="flex items-center space-x-1 cursor-pointer"
              title="Click to view changes and stage commit"
            >
              {summary.is_merging ? (
                <span className="flex items-center text-amber-300 text-[11px] bg-amber-950/80 border border-amber-600 px-2 py-0.5 rounded animate-pulse">
                  <AlertTriangle size={11} className="mr-1 text-amber-400" /> Merging (Conflicts)
                </span>
              ) : summary.is_clean ? (
                <span className="flex items-center text-emerald-400 text-[11px] bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  <CheckCircle2 size={11} className="mr-1" /> Clean
                </span>
              ) : (
                <span className="flex items-center text-amber-400 text-[11px] bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded hover:bg-amber-900/60 transition">
                  <AlertCircle size={11} className="mr-1" /> Pending changes
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* CONFLICT / MERGE IN PROGRESS BANNER */}
      {summary?.is_merging && (
        <div className="bg-amber-950/90 border-b border-amber-600/70 px-4 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0 shadow-inner z-20">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
            <span className="font-semibold text-amber-100">Merge in progress with conflicts!</span>
            <span className="text-amber-300/80 hidden sm:inline">
              Resolve conflicts in File Status and commit, or abort the merge.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {activeView !== "working_copy" && (
              <button
                onClick={() => setActiveView("working_copy")}
                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-100 rounded text-[11px] font-medium border border-amber-500/40 cursor-pointer transition"
              >
                Go to File Status
              </button>
            )}
            <button
              onClick={handleAbortMerge}
              disabled={isAbortingMerge}
              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-60 text-white rounded text-[11px] font-semibold cursor-pointer transition shadow"
            >
              {isAbortingMerge ? "Aborting..." : "Abort Merge"}
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR (SourceTree Style) */}
        <aside className="w-56 bg-[#1b1b1e] border-r border-zinc-800 flex flex-col shrink-0 text-xs">
          <div className="p-3 border-b border-zinc-800/80 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* WORKSPACE SECTION (SourceTree File Status vs History) */}
            <div>
              <div className="text-zinc-500 font-semibold px-2 py-1 text-[10px] uppercase tracking-wider">
                Workspace
              </div>
              <ul className="mt-0.5 space-y-0.5">
                <li
                  onClick={() => setActiveView("working_copy")}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition ${
                    activeView === "working_copy"
                      ? "bg-sky-600/20 text-sky-300 font-semibold border-l-2 border-sky-400"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <FileDiff size={14} className="text-amber-400" />
                    <span>File Status</span>
                  </span>
                  {summary && !summary.is_clean && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </li>

                <li
                  onClick={handleSwitchToHistory}
                  className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer transition ${
                    activeView === "history"
                      ? "bg-sky-600/20 text-sky-300 font-semibold border-l-2 border-sky-400"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <Layers size={14} className="text-sky-400" />
                  <span>History</span>
                </li>
              </ul>
            </div>

            {/* LOCAL BRANCHES */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1">
                <span className="flex items-center space-x-1.5">
                  <GitBranch size={13} className="text-purple-400" />
                  <span>Local Branches ({localBranches.length})</span>
                </span>
              </div>
              <div className="mt-1">
                <BranchTree
                  branches={localBranches}
                  currentBranch={summary?.current_branch}
                  onSelectBranch={handleSelectBranch}
                  onCheckoutBranch={handleCheckoutLocalBranch}
                  onDeleteBranch={handleDeleteLocalBranch}
                  onMergeBranch={(b) => handleOpenMerge(b.name)}
                />
              </div>
            </div>

            {/* REMOTE BRANCHES & REPOSITORIES */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1 group">
                <span className="flex items-center space-x-1.5">
                  <Cloud size={13} className="text-sky-400" />
                  <span>Remote ({remotes.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsManageRemotesOpen(true)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 transition cursor-pointer"
                  title="Manage / Add Remotes"
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="mt-1">
                {remotes.length === 0 ? (
                  <div
                    onClick={() => setIsManageRemotesOpen(true)}
                    className="mx-2 my-1 p-2.5 rounded border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-800/40 text-center cursor-pointer transition text-zinc-500 hover:text-sky-400"
                  >
                    <p className="text-[11px] font-medium flex items-center justify-center space-x-1">
                      <Plus size={12} />
                      <span>Add Remote</span>
                    </p>
                  </div>
                ) : (
                  <BranchTree
                    branches={remoteBranches}
                    currentBranch={summary?.current_branch}
                    onSelectBranch={handleSelectBranch}
                    onCheckoutRemoteBranch={handleCheckoutRemoteBranch}
                    onDeleteRemoteBranch={handleDeleteRemoteBranch}
                    onMergeBranch={(b) => handleOpenMerge(b.name)}
                    isRemote={true}
                    configuredRemotes={remotes.map((r) => r.name)}
                  />
                )}
              </div>
            </div>

            {/* TAGS */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1 group">
                <span className="flex items-center space-x-1.5">
                  <Tag size={13} className="text-amber-400" />
                  <span>Tags ({tags.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenCreateTag()}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition cursor-pointer"
                  title="Create Tag"
                >
                  <Plus size={13} />
                </button>
              </div>
              <div className="mt-1">
                <TagList
                  tags={tags}
                  remotes={remotes}
                  selectedTagName={activeView === "history" ? selectedTagName : null}
                  onSelectTag={handleSelectTag}
                  onPushTag={handlePushTag}
                  onDeleteTag={handleDeleteTag}
                  onDeleteRemoteTag={handleDeleteRemoteTag}
                />
              </div>
            </div>

            {/* STASHES */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1 group">
                <span className="flex items-center space-x-1.5">
                  <Archive size={13} className="text-orange-400" />
                  <span>Stashes ({stashes.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsStashModalOpen(true)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-orange-400 transition cursor-pointer"
                  title="Stash Changes"
                >
                  <Plus size={13} />
                </button>
              </div>
              <div className="mt-1">
                <StashList
                  stashes={stashes}
                  selectedStash={activeView === "stash" ? selectedStash : null}
                  onSelectStash={handleSelectStash}
                  onApplyStash={handleApplyStash}
                  onPopStash={handlePopStash}
                  onDropStash={handleDropStash}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT AREA: CONDITIONAL VIEW */}
        {activeView === "working_copy" ? (
          <WorkingCopyView
            repoPath={repoPath}
            refreshKey={refreshKey}
            onCommitSuccess={handleCommitSuccess}
            onStatusChange={refreshAll}
          />
        ) : activeView === "stash" && selectedStash ? (
          /* STASH PREVIEW VIEW */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#141416]">
            {/* Stash Header */}
            <div className="px-4 py-3 bg-[#1c1c1f] border-b border-zinc-800 flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <Archive size={15} className="text-orange-400 shrink-0" />
                  <span className="font-mono text-xs font-semibold text-orange-300">
                    {selectedStash.reference}
                  </span>
                  {selectedStash.branch && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                      on {selectedStash.branch}
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-500">
                    {formatDate(selectedStash.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-zinc-100 truncate">
                  {selectedStash.message}
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => handleApplyStash(selectedStash)}
                  disabled={isStashOperating}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <Play size={13} />
                  <span>Apply</span>
                </button>
                <button
                  onClick={() => handlePopStash(selectedStash)}
                  disabled={isStashOperating}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={13} />
                  <span>Pop</span>
                </button>
                <button
                  onClick={() => handleDropStash(selectedStash)}
                  disabled={isStashOperating}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Stash Files & Diff Split */}
            <div className="flex-1 flex min-h-0 overflow-hidden bg-[#1c1c1f] text-xs">
              <div
                style={{ width: `${fileListPercent}%` }}
                className="flex flex-col shrink-0 border-r border-zinc-800 overflow-hidden"
              >
                <div className="px-3 py-2 bg-[#1e1e22] border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0">
                  Stashed Files ({stashFiles.length})
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <FileTree
                    files={stashFiles}
                    selectedFile={selectedStashFile}
                    onSelectFile={(f) => setSelectedStashFile(f)}
                    loading={loadingStashFiles}
                  />
                </div>
              </div>

              <div
                onMouseDown={handleHorizontalResize}
                className="w-1.5 h-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-col-resize shrink-0 transition-colors z-20"
                title="Drag to resize files width"
              />

              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <DiffViewer
                  diffText={stashDiffText}
                  loading={loadingStashDiff}
                  filePath={selectedStashFile?.path}
                />
              </div>
            </div>
          </div>
        ) : (
          /* HISTORY GRAPH VIEW */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#141416]">
            {error && (
              <div className="m-3 p-3 bg-red-950/40 border border-red-800 text-red-300 rounded text-xs">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* COMMIT GRAPH TABLE (Occupies remaining vertical space, 50% by default) */}
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full border-collapse text-left text-xs table-fixed">
                <thead className="sticky top-0 bg-[#1e1e22] text-zinc-400 border-b border-zinc-800 z-10 text-[11px]">
                  <tr>
                    <th className="py-1 px-3 font-semibold w-24">Graph</th>
                    <th className="py-1 px-3 font-semibold">Description</th>
                    <th className="py-1 px-3 font-semibold w-20">Hash</th>
                    <th className="py-1 px-3 font-semibold w-36">Author</th>
                    <th className="py-1 px-3 font-semibold w-36">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 font-normal">
                  {commits.map((c) => {
                    const isUncommitted = c.hash === "uncommitted";
                    const isSelected = selectedCommit?.hash === c.hash;
                    return (
                      <tr
                        key={c.hash}
                        onClick={() => {
                          if (isUncommitted) {
                            setActiveView("working_copy");
                          } else {
                            setSelectedCommit(c);
                          }
                        }}
                        onContextMenu={(e) => {
                          if (isUncommitted) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const menuWidth = 230;
                          const menuHeight = 270;
                          const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
                          const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
                          setCommitContextMenu({ x, y, commit: c });
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-600/20 text-white"
                            : isUncommitted
                            ? "hover:bg-amber-950/20 text-amber-300"
                            : "hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                        style={{ height: "26px" }}
                      >
                        {/* Grafo SVG */}
                        <td className="p-0 align-middle">
                          <GraphCell
                            node_col={c.node_col}
                            color_index={c.color_index}
                            max_col={c.max_col}
                            segments={c.segments}
                            isSelected={isSelected}
                            isUncommitted={isUncommitted}
                          />
                        </td>

                        {/* Mensaje + Badges de Ramas */}
                        <td className="py-0.5 px-3 truncate font-medium">
                          <div className="flex items-center space-x-1.5 overflow-hidden">
                            {isUncommitted ? (
                              <span className="font-semibold text-amber-400 italic flex items-center space-x-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                                <span>Uncommitted changes</span>
                              </span>
                            ) : (
                              <>
                                {c.refs.map((ref) => {
                                  const isTag = ref.startsWith("tag: ");
                                  const displayRef = isTag ? ref.slice(5) : ref;
                                  return (
                                    <span
                                      key={ref}
                                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold shrink-0 inline-flex items-center space-x-1 ${
                                        ref.includes("HEAD")
                                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                                          : isTag
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                          : ref.includes("origin/")
                                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                      }`}
                                    >
                                      {isTag && <Tag size={9} className="shrink-0" />}
                                      <span>{displayRef}</span>
                                    </span>
                                  );
                                })}
                                <span className="truncate">{c.summary}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Hash */}
                        <td className="py-0.5 px-3 font-mono text-zinc-400 text-[11px]">
                          {isUncommitted ? "—" : c.short_hash}
                        </td>

                        {/* Autor */}
                        <td className="py-0.5 px-3 truncate text-zinc-400 text-[11px]">
                          {isUncommitted ? "—" : c.author_name}
                        </td>

                        {/* Fecha */}
                        <td className="py-0.5 px-3 text-zinc-500 text-[11px] truncate">
                          {isUncommitted ? "—" : formatDate(c.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VERTICAL RESIZER HANDLE (between commits table and bottom panel) */}
            {selectedCommit && (
              <div
                onMouseDown={handleVerticalResize}
                className="h-1.5 w-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-row-resize shrink-0 transition-colors z-20"
                title="Drag to resize bottom panel"
              />
            )}

            {/* BOTTOM COMMIT INSPECTION PANEL (Default 50% vertical space, adjustable) */}
            {selectedCommit && (
              <div
                style={{ height: `${bottomHeightPercent}%` }}
                className="bg-[#1c1c1f] flex shrink-0 text-xs overflow-hidden"
              >
                {/* Left Column: Commit Detailed Info & Changed Files (~42% default width) */}
                <div
                  style={{ width: `${fileListPercent}%` }}
                  className="flex flex-col h-full shrink-0 overflow-hidden"
                >
                  {/* TOP SUB-PANEL: COMMIT DETAILED INFORMATION (~40% default height) */}
                  <div
                    style={{ height: `${commitInfoPercent}%` }}
                    className="flex flex-col shrink-0 overflow-y-auto min-h-0 bg-[#1e1e22] p-2.5 space-y-2 select-text border-b border-zinc-800/80"
                  >
                    {/* Header row: Full hash & Date */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <span
                          onClick={() => handleCopyHash(selectedCommit.hash)}
                          className="font-mono text-amber-400 font-semibold text-[11px] truncate cursor-pointer hover:underline hover:text-amber-300 transition"
                          title="Click to copy full Hash"
                        >
                          {selectedCommit.hash}
                        </span>
                        {copiedHash ? (
                          <span className="text-[9px] text-emerald-400 font-sans font-medium px-1 rounded bg-emerald-950/60 border border-emerald-800/60 shrink-0">
                            Copied!
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCopyHash(selectedCommit.hash)}
                            className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer shrink-0"
                            title="Copy Hash"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center text-zinc-400 text-[10px] space-x-1 shrink-0">
                        <Clock size={11} className="text-zinc-500" />
                        <span>{formatDate(selectedCommit.timestamp)}</span>
                      </div>
                    </div>

                    {/* Author row: Name & Email */}
                    <div className="flex items-center space-x-1.5 text-[11px]">
                      <User size={12} className="text-zinc-400 shrink-0" />
                      <span className="font-semibold text-zinc-200">{selectedCommit.author_name}</span>
                      {selectedCommit.author_email && (
                        <span className="text-zinc-400 font-mono text-[10px] truncate">
                          &lt;{selectedCommit.author_email}&gt;
                        </span>
                      )}
                    </div>

                    {/* Parent commits row (if any) - without surrounding box */}
                    {selectedCommit.parents.length > 0 && (
                      <div className="flex items-center space-x-1 text-[10px]">
                        <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">
                          # Parents:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {selectedCommit.parents.map((parentHash) => {
                            const shortP = parentHash.length >= 7 ? parentHash.slice(0, 7) : parentHash;
                            const parentCommit = commits.find((c) => c.hash.startsWith(shortP) || parentHash.startsWith(c.hash));
                            return (
                              <button
                                key={parentHash}
                                onClick={() => {
                                  if (parentCommit) setSelectedCommit(parentCommit);
                                }}
                                className="text-sky-400 hover:text-sky-300 hover:underline font-mono text-[10px] cursor-pointer transition mr-1.5"
                                title={parentCommit ? `Jump to parent commit: ${parentCommit.summary}` : parentHash}
                              >
                                {shortP}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Commit Subject / Summary */}
                    <div className="font-semibold text-zinc-100 text-[11px] leading-snug">
                      {selectedCommit.summary}
                    </div>

                    {/* Commit Description / Body (if present) */}
                    {selectedCommit.body && (
                      <div className="text-zinc-300 text-[11px] font-normal leading-relaxed whitespace-pre-wrap pt-1 border-t border-zinc-800/60">
                        {selectedCommit.body}
                      </div>
                    )}
                  </div>

                  {/* HORIZONTAL RESIZER BETWEEN COMMIT INFO & FILE TREE */}
                  <div
                    onMouseDown={handleCommitInfoResize}
                    className="h-1.5 w-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-row-resize shrink-0 transition-colors z-10"
                    title="Drag to resize commit info and files"
                  />

                  {/* BOTTOM SUB-PANEL: FILE TREE (~60% default height) */}
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <FileTree
                      files={commitFiles}
                      selectedFile={selectedFile}
                      onSelectFile={(f) => setSelectedFile(f)}
                      loading={loadingFiles}
                    />
                  </div>
                </div>

                {/* HORIZONTAL RESIZER HANDLE (between Left Column and Diff Viewer) */}
                <div
                  onMouseDown={handleHorizontalResize}
                  className="w-1.5 h-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-col-resize shrink-0 transition-colors z-20"
                  title="Drag to resize files width"
                />

                {/* Right Column: Unified Diff Viewer */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  <DiffViewer
                    diffText={diffText}
                    loading={loadingDiff}
                    filePath={selectedFile?.path}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PULL MODAL */}
      <PullModal
        isOpen={isPullOpen}
        onClose={() => setIsPullOpen(false)}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        remotes={remotes}
        remoteBranches={remoteBranches}
        onSuccess={(output) => {
          refreshAll();
          setOperationModal({
            status: "success",
            title: "Pull Completed",
            message: "Changes pulled from remote successfully.",
            output,
          });
        }}
      />

      {/* PUSH MODAL */}
      <PushModal
        isOpen={isPushOpen}
        onClose={() => setIsPushOpen(false)}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        localBranches={localBranches}
        remotes={remotes}
        aheadCount={aheadBehind.ahead}
        onSuccess={(output) => {
          refreshAll();
          setOperationModal({
            status: "success",
            title: "Push Completed",
            message: "Changes pushed to remote successfully.",
            output,
          });
        }}
      />

      {/* MANAGE REMOTES MODAL */}
      <ManageRemotesModal
        isOpen={isManageRemotesOpen}
        onClose={() => setIsManageRemotesOpen(false)}
        repoPath={repoPath}
        remotes={remotes}
        onRefresh={() => {
          refreshAll();
        }}
      />

      {/* CREATE BRANCH MODAL */}
      <CreateBranchModal
        isOpen={isCreateBranchOpen}
        onClose={() => {
          setIsCreateBranchOpen(false);
          setBranchBaseCommit(null);
          setBranchBaseOption("head");
        }}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        currentCommit={branchBaseCommit || selectedCommit}
        commits={commits}
        existingLocalBranches={localBranches.map((b) => b.name)}
        initialBaseOption={branchBaseOption}
        onSuccess={() => {
          refreshAll();
        }}
      />

      {/* CHECKOUT REMOTE BRANCH MODAL */}
      {checkoutRemoteTarget && (
        <CheckoutRemoteModal
          isOpen={!!checkoutRemoteTarget}
          onClose={() => setCheckoutRemoteTarget(null)}
          repoPath={repoPath}
          remoteBranchName={checkoutRemoteTarget.name}
          existingLocalBranches={localBranches.map((b) => b.name)}
          onSuccess={() => {
            refreshAll();
          }}
        />
      )}

      {/* MERGE MODAL */}
      <MergeModal
        isOpen={isMergeOpen}
        onClose={() => {
          setIsMergeOpen(false);
          setMergeSourceBranch(null);
        }}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        localBranches={localBranches}
        remoteBranches={remoteBranches}
        initialSourceBranch={mergeSourceBranch}
        onSuccess={handleMergeSuccess}
      />

      {/* CONFIRM CHECKOUT WITH UNCOMMITTED CHANGES MODAL */}
      {confirmCheckoutTarget && (
        <ConfirmCheckoutModal
          isOpen={!!confirmCheckoutTarget}
          onClose={() => setConfirmCheckoutTarget(null)}
          targetBranchName={confirmCheckoutTarget.name}
          onConfirm={handleConfirmCheckout}
        />
      )}

      {/* COMMIT CONTEXT MENU */}
      {commitContextMenu && (
        <div
          style={{ top: commitContextMenu.y, left: commitContextMenu.x }}
          className="fixed z-50 w-56 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl py-1 text-xs text-zinc-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-zinc-500 border-b border-zinc-800 font-mono truncate">
            {commitContextMenu.commit.short_hash} · {commitContextMenu.commit.summary}
          </div>
          <button
            onClick={() => {
              const target = commitContextMenu.commit;
              setCommitContextMenu(null);
              handleCheckoutCommit(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <GitCommit size={13} className="text-sky-400" />
            <span>Checkout Commit...</span>
          </button>
          <button
            onClick={() => {
              const target = commitContextMenu.commit;
              setCommitContextMenu(null);
              handleCreateBranchFromCommit(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <GitBranch size={13} className="text-purple-400" />
            <span>Create Branch...</span>
          </button>
          <button
            onClick={() => {
              const targetHash = commitContextMenu.commit.hash;
              setCommitContextMenu(null);
              handleOpenCreateTag(targetHash);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Tag size={13} className="text-amber-400" />
            <span>Tag...</span>
          </button>

          <div className="my-1 border-t border-zinc-800" />

          <button
            onClick={() => {
              const target = commitContextMenu.commit;
              setCommitContextMenu(null);
              handleCherryPickCommit(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <GitPullRequest size={13} className="text-emerald-400" />
            <span>Cherry-pick...</span>
          </button>
          <button
            onClick={() => {
              const target = commitContextMenu.commit;
              setCommitContextMenu(null);
              handleRevertCommit(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Undo2 size={13} className="text-orange-400" />
            <span>Revert Commit...</span>
          </button>
          <button
            onClick={() => {
              const target = commitContextMenu.commit;
              setCommitContextMenu(null);
              setResetTargetCommit(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-950/40 text-red-300 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <AlertTriangle size={13} className="text-red-400" />
            <span>Reset Branch to Here...</span>
          </button>

          <div className="my-1 border-t border-zinc-800" />

          <button
            onClick={() => {
              const hash = commitContextMenu.commit.hash;
              const shortHash = commitContextMenu.commit.short_hash;
              setCommitContextMenu(null);
              navigator.clipboard.writeText(hash);
              showToast(`Copied hash ${shortHash}`, "success", 2500);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Copy size={13} className="text-zinc-400" />
            <span>Copy Commit Hash</span>
          </button>
        </div>
      )}

      {/* RESET COMMIT MODAL */}
      <ResetCommitModal
        isOpen={!!resetTargetCommit}
        onClose={() => setResetTargetCommit(null)}
        currentBranch={summary?.current_branch || null}
        commit={resetTargetCommit}
        onConfirm={handleConfirmResetCommit}
      />

      {/* CREATE TAG MODAL */}
      <CreateTagModal
        isOpen={isCreateTagOpen}
        onClose={() => {
          setIsCreateTagOpen(false);
          setTagTargetHash(null);
        }}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        commits={commits}
        remotes={remotes}
        initialTargetHash={tagTargetHash}
        onSuccess={(tagName, pushedToRemote) => {
          refreshAll();
          if (pushedToRemote) {
            setOperationModal({
              status: "success",
              title: "Tag Created & Pushed",
              message: `Tag '${tagName}' was created and pushed to '${pushedToRemote}' successfully.`,
            });
          } else {
            showToast(`Tag '${tagName}' created successfully`, "success");
          }
        }}
      />

      {/* DELETE TAG MODAL */}
      <DeleteTagModal
        isOpen={!!deleteTagTarget}
        onClose={() => setDeleteTagTarget(null)}
        repoPath={repoPath}
        tag={deleteTagTarget}
        remotes={remotes}
        onConfirm={handleConfirmDeleteTag}
      />

      {/* STASH MODAL */}
      <StashModal
        isOpen={isStashModalOpen}
        onClose={() => setIsStashModalOpen(false)}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        onSuccess={() => {
          refreshAll();
          setFetchToast({
            message: "Changes stashed successfully",
            type: "success",
          });
          setTimeout(() => setFetchToast(null), 4000);
        }}
      />

      {/* OPERATION PROGRESS / RESULT MODAL */}
      <OperationModal
        state={operationModal}
        onClose={() => setOperationModal(null)}
      />

      {/* ERROR MODAL (DISMISSED WITH ACEPTAR BUTTON) */}
      {errorModal && (
        <ErrorModal
          isOpen={!!errorModal}
          onClose={() => setErrorModal(null)}
          title={errorModal.title}
          message={errorModal.message}
        />
      )}

      {/* FETCH NOTIFICATION TOAST */}
      {fetchToast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center space-x-2 px-3.5 py-2 rounded shadow-xl text-xs border transition-all ${
            fetchToast.type === "success"
              ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
              : "bg-red-950/90 border-red-700 text-red-200"
          }`}
        >
          {fetchToast.type === "success" ? (
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={15} className="text-red-400 shrink-0" />
          )}
          <span>{fetchToast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
