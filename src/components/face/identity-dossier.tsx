"use client"

import { useState } from "react"
import { X, Save, User, Trash2, Plus, Link, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Identity {
  id: number
  name: string
  primary_face_id: string | null
  merged_faces: string[]
  threads_username: string | null
  notes: string | null
  tags: string[]
  created_by: string
  created_at: string
  updated_at: string
}

interface Props {
  identity: Identity
  onClose: () => void
  onUpdate: (updated: Identity) => void
  onDelete: (id: number) => void
  onRemoveFace?: (identityId: number, faceId: string) => void
}

export function IdentityDossier({ identity, onClose, onUpdate, onDelete }: Props) {
  const [name, setName] = useState(identity.name)
  const [notes, setNotes] = useState(identity.notes || "")
  const [tags, setTags] = useState(identity.tags?.join(", ") || "")
  const [threadsUsername, setThreadsUsername] = useState(identity.threads_username || "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/face/identities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: identity.id,
          name,
          notes: notes || null,
          tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          threads_username: threadsUsername || null,
        }),
      })
      const data = await res.json()
      if (data.identity) {
        onUpdate(data.identity)
      }
    } catch (err) {
      console.error("Failed to save identity:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Delete this identity? This cannot be undone.")) return
    setDeleting(true)
    try {
      await fetch(`/api/face/identities?id=${identity.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      onDelete(identity.id)
    } catch (err) {
      console.error("Failed to delete identity:", err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="relative max-w-lg w-full bg-[#0f0c12] rounded-xl overflow-hidden border border-[#2c2535] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-[#2c2535] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--mode-face)]" />
            <h2 className="text-lg font-semibold text-zinc-100">Identity Dossier</h2>
          </div>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Name */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm border-[#2c2535] bg-[#0f0c12] text-zinc-100"
            />
          </div>

          {/* Threads Username */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Threads Username</label>
            <Input
              value={threadsUsername}
              onChange={(e) => setThreadsUsername(e.target.value)}
              placeholder="@username"
              className="h-9 text-sm border-[#2c2535] bg-[#0f0c12] text-zinc-100"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tags (comma-separated)</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="suspicious, threat-actor, osint"
              className="h-9 text-sm border-[#2c2535] bg-[#0f0c12] text-zinc-100"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Investigation notes..."
              className="w-full h-20 px-3 py-2 rounded-lg border border-[#2c2535] bg-[#0f0c12] text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Merged Faces */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              Merged Faces ({identity.merged_faces?.length || 0})
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {identity.merged_faces?.map((faceId, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-[#16111f] border border-[#2c2535] rounded px-2 py-1">
                  <code className="text-zinc-300 truncate">{faceId}</code>
                  {faceId === identity.primary_face_id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-[var(--mode-face)]">Primary</span>
                  )}
                </div>
              ))}
              {(!identity.merged_faces || identity.merged_faces.length === 0) && (
                <p className="text-xs text-zinc-500">No faces merged yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#2c2535] flex gap-3 shrink-0">
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 bg-[var(--mode-face)] hover:brightness-110 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="outline"
            className="bg-red-600/20 hover:bg-red-600/30 border-red-600/30 text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
