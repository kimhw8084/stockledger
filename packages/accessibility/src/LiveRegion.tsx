import {useEffect,useRef} from 'react';
import {AccessibilityInfo,Platform,StyleSheet,Text as RNText} from 'react-native';
import {normalizeLiveMessage,shouldAnnounceChange} from '@expo-base/platform';
export type LivePoliteness='polite'|'assertive';
export function LiveRegion({message,politeness='polite',visuallyHidden=false}:{message:string;politeness?:LivePoliteness | undefined;visuallyHidden?:boolean | undefined}){const previous=useRef<string | undefined>(undefined);const normalized=normalizeLiveMessage(message);useEffect(()=>{if(Platform.OS==='ios'&&shouldAnnounceChange(previous.current,normalized))AccessibilityInfo.announceForAccessibility(normalized);previous.current=normalized;},[normalized]);return <RNText accessibilityLiveRegion={politeness} aria-live={politeness} style={visuallyHidden?styles.hidden:undefined}>{normalized}</RNText>}
const styles=StyleSheet.create({hidden:{position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',opacity:0.01}});
