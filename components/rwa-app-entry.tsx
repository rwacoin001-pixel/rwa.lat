'use client'
import dynamic from 'next/dynamic'
import AppLoading from './app-loading'

// This app reads its account state on the device. Avoid executing the whole screen
// graph on the edge just to render its initial empty loading surface.
const RwaAppEntry=dynamic(()=>import('./rwa-h5'),{ssr:false,loading:AppLoading})
export default RwaAppEntry
