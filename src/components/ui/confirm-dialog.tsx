"use client";

import * as React from "react";
import {
  Modal,
  ModalBasicLayout,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Text,
} from "@vibe/core";

/* Standard confirmation modal (Vibe Modal, "small"). Use for deletes and
   other irreversible actions instead of window.confirm. */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal id="confirm-dialog" show={open} size="small" onClose={onClose}>
      <ModalBasicLayout>
        <ModalHeader title={title} />
        <ModalContent>
          <Text type="text1">{message}</Text>
        </ModalContent>
      </ModalBasicLayout>
      <ModalFooter
        primaryButton={{
          text: confirmText,
          onClick: onConfirm,
          loading,
          color: destructive ? "negative" : "primary",
        }}
        secondaryButton={{ text: cancelText, onClick: onClose }}
      />
    </Modal>
  );
}
