import { useState } from "react";

export interface PlaylistFormValues {
  name: string;
  description: string;
}

interface PlaylistFormProps {
  title: string;
  initial?: PlaylistFormValues;
  onSubmit: (values: PlaylistFormValues) => void;
  onClose: () => void;
}

/** Modal used for creating and editing playlists. */
export function PlaylistForm({
  title,
  initial,
  onSubmit,
  onClose,
}: PlaylistFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name, description });
        }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-elevated p-6 shadow-xl-dark"
      >
        <h2 className="text-[18px]/[24px] font-semibold text-fg">{title}</h2>
        <label className="mt-4 block text-[12px]/[16px] font-medium uppercase tracking-wide text-subtle">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
            placeholder="My playlist"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[14px] text-fg outline-none placeholder:text-subtle focus:border-accent/50"
          />
        </label>
        <label className="mt-3 block text-[12px]/[16px] font-medium uppercase tracking-wide text-subtle">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What's this playlist about?"
            className="mt-1 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[14px] text-fg outline-none placeholder:text-subtle focus:border-accent/50"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full px-5 py-2 text-[14px]/[20px] font-semibold text-fg transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="cursor-pointer rounded-full bg-fg px-6 py-2 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
