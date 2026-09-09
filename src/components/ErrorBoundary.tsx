import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from '../ui/Button'

/* ═══════════════════════════════════════════════════════════════════════
   Last line of defence — the web counterpart of the ErrorWidget.builder
   override in main.dart.

   A render crash mid-checkout must not leave a white screen: that is the
   moment somebody assumes their money vanished. We show a calm recovery
   instead, and we never print the error text to the customer — stack traces
   leak file paths, and occasionally tokens.
   ═══════════════════════════════════════════════════════════════════════ */

interface Props {
  children: ReactNode
}

interface State {
  crashed: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console only; wire this to a reporter when there is one.
    console.error('[blorbmart] render crash', error, info.componentStack)
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 'var(--gap-md)',
          padding: 'var(--gap-xxxl) var(--gap-page)',
          background: 'var(--color-canvas)',
        }}
      >
        <img
          src="/assets/icon.png"
          alt=""
          width={56}
          height={56}
          style={{ borderRadius: 'var(--radius-md)', opacity: 0.7 }}
        />
        <h1 className="t-h1" style={{ margin: 0 }}>
          That did not load
        </h1>
        <p className="t-body" style={{ margin: 0, maxWidth: 320 }}>
          Something on this screen broke. Your basket and your orders are safe — reloading
          usually clears it.
        </p>

        <div style={{ width: '100%', maxWidth: 320, marginTop: 'var(--gap-lg)' }}>
          <Button label="Reload Blorbmart" onClick={() => window.location.reload()} />
          <div style={{ height: 'var(--gap-md)' }} />
          <Button
            label="Back to home"
            kind="outline"
            onClick={() => {
              window.location.href = '/home'
            }}
          />
        </div>
      </div>
    )
  }
}
