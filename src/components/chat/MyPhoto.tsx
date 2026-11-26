"use client";

import { removeMyAvatar, setMyAvatar } from "@/client/api/chat";
import { notify } from "@/components/toast";
import { Avatar } from "./ChatBits";
import { PhotoPicker } from "./PhotoPicker";
import { setAvatarVersion, useAvatarVersion } from "./avatarStore";
import { useChatT } from "./useChatT";

/** Your own profile photo, with change/remove — shown on the profile page. */
export default function MyPhoto({ userId, name, size = 96 }: { userId: string; name: string; size?: number }) {
  const { t } = useChatT();
  const version = useAvatarVersion(userId);
  const fail = (e: unknown) => {
    const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
    notify(status === 413 ? t("photoTooLarge") : status === 422 ? t("photoRejected") : t("failed"), "error");
  };
  return (
    <PhotoPicker
      hasPhoto={Boolean(version)}
      labels={{ change: t("changePhoto"), remove: t("removePhoto"), tooLarge: t("photoTooLarge") }}
      onError={(m) => notify(m, "error")}
      onPick={async (file) => {
        try {
          const { version: v } = await setMyAvatar(file);
          setAvatarVersion(userId, v);
          notify(t("photoUpdated"), "success");
        } catch (e) {
          fail(e);
        }
      }}
      onRemove={async () => {
        try {
          await removeMyAvatar();
          setAvatarVersion(userId, null);
        } catch (e) {
          fail(e);
        }
      }}
    >
      <Avatar name={name} seed={userId} size={size} />
    </PhotoPicker>
  );
}
