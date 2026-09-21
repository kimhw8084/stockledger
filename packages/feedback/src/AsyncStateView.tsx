import type { ReactNode } from 'react';
import { resolveAsyncState, safeErrorMessage } from '@expo-base/platform';
import { AlertBanner } from './AlertBanner';
import { LoadingState } from './Loading';
import { StateView } from './StateView';
import { Button } from '@expo-base/components';
import { VStack } from '@expo-base/primitives';

export interface AsyncStateViewProps { loading?:boolean | undefined; offline?:boolean | undefined; error?:unknown; itemCount:number; children:ReactNode; onRetry?:(()=>void) | undefined; empty?:ReactNode | undefined; }
export function AsyncStateView({loading,offline,error,itemCount,children,onRetry,empty}:AsyncStateViewProps){const state=resolveAsyncState({loading,offline,error,itemCount}); if(state.primary==='loading')return <LoadingState/>; if(state.primary==='offline')return <StateView kind="offline" actionLabel={onRetry?'Try again':undefined} onAction={onRetry}/>; if(state.primary==='error')return <StateView kind="error" message={safeErrorMessage(error)} actionLabel={onRetry?'Try again':undefined} onAction={onRetry}/>; if(state.primary==='empty')return <>{empty??<StateView kind="empty"/>}</>; return <VStack gap="md">{state.degraded==='refreshing'?<AlertBanner tone="info" title="Refreshing" message="Showing the latest available data while an update is in progress."/>:state.degraded==='offline'?<AlertBanner tone="warning" title="Offline" message="Showing previously loaded data. Changes may not be current."/>:state.degraded==='error'?<AlertBanner tone="warning" title="Update failed" message="Showing previously loaded data because the latest refresh failed." action={onRetry?<Button label="Try again" variant="outline" size="sm" onPress={onRetry}/>:undefined}/>:null}{children}</VStack>}
