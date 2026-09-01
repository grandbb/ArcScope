"use client";
import { useEnsAvatar, useEnsName } from "wagmi";
export function useENSProfile(address?: `0x${string}`) { const name = useEnsName({ address, chainId: 1, query: { enabled: Boolean(address) } }); const avatar = useEnsAvatar({ name: name.data ?? undefined, chainId: 1, query: { enabled: Boolean(name.data) } }); return { name: name.data, avatar: avatar.data, isLoading: name.isLoading || avatar.isLoading, error: name.error ?? avatar.error }; }
