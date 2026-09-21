import type {PropsWithChildren} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
export function VisuallyHidden({children}:PropsWithChildren){return <View style={styles.hidden}>{children}</View>}
const styles=StyleSheet.create(()=>({hidden:{position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',opacity:0.01}}));
