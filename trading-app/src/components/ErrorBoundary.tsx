import { Component, type ErrorInfo, type ReactNode } from 'react';
import { STORAGE_KEY } from '../lib/storage';

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('应用渲染错误', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page" style={{ padding: '2rem', maxWidth: 560 }}>
          <h2>页面加载出错</h2>
          <p className="muted">
            可能是浏览器缓存或本地数据异常。可尝试清除本站数据后刷新。
          </p>
          <pre
            className="card"
            style={{
              fontSize: '0.8rem',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch {
                  /* ignore */
                }
                window.location.href = import.meta.env.BASE_URL || '/';
              }}
            >
              重置本地数据并返回首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
