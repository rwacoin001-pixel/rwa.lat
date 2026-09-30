import styles from './app-loading.module.css'

/** Route and first-load placeholder: a still, page-coloured surface with no animation. */
export default function AppLoading() {
  return <div className={styles.root} data-app-loading="true" aria-busy="true" aria-label="Loading RWA.LAT" role="status" />
}
