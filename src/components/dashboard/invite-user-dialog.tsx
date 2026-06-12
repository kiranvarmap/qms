"use client";

import { useState } from "react";
import {
  AttentionBox,
  Button,
  Dropdown,
  Modal,
  ModalBasicLayout,
  ModalContent,
  ModalFooter,
  ModalHeader,
  TextField,
} from "@vibe/core";
import { Invite } from "@vibe/icons";

const roleOptions = [
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleInvite = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: role.value }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setMessage(data.message);
        setEmail("");
        setTimeout(() => {
          setOpen(false);
          setMessage("");
        }, 2000);
      }
    } catch {
      setError("Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="small" leftIcon={Invite} onClick={() => setOpen(true)}>
        Invite User
      </Button>

      <Modal
        id="invite-user-modal"
        show={open}
        size="small"
        onClose={() => setOpen(false)}
      >
        <ModalBasicLayout>
          <ModalHeader
            title="Invite a user"
            description="Send an email invitation to join your workspace."
          />
          <ModalContent>
            <div className="space-y-4 pb-2">
              {error && (
                <AttentionBox type="negative" text={error} compact />
              )}
              {message && (
                <AttentionBox type="positive" text={message} compact />
              )}

              <TextField
                title="Email address"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(value: string) => setEmail(value)}
                size="medium"
                required
              />

              <div>
                <span className="block text-sm text-text-primary mb-1">
                  Role
                </span>
                <Dropdown
                  options={roleOptions}
                  value={role}
                  onChange={(option: { value: string; label: string }) =>
                    option && setRole(option)
                  }
                  clearable={false}
                  size="small"
                />
              </div>
            </div>
          </ModalContent>
        </ModalBasicLayout>
        <ModalFooter
          primaryButton={{
            text: "Send invitation",
            onClick: handleInvite,
            loading,
            disabled: !email,
          }}
          secondaryButton={{
            text: "Cancel",
            onClick: () => setOpen(false),
          }}
        />
      </Modal>
    </>
  );
}
