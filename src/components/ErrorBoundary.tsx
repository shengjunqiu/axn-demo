/**
 * 兜底错误页（ErrorBoundary）：渲染期异常的最后一道防线，替代白屏。
 *
 * 边界只捕获渲染 / 生命周期 / 子树中的同步异常；事件回调与未处理的 Promise 拒绝
 * 不会走到这里（那两类异常仍会冒到 window，不在此组件职责内）。
 *
 * 用法：包住应用或某个面板。出错时给两个动作 ——
 * 「重试」清掉错误状态、重新渲染子树；「重置演示数据」复用既有重置链路（store/resetDemo）回到种子态。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Space, Typography } from 'antd';
import { NAV_PATH } from '@/components/nav/navRoutes';
import { resetDemoData } from '@/store/resetDemo';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[anneng-demo] 渲染异常，已显示兜底页。', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  private handleReset = (): void => {
    try {
      resetDemoData();
      // 兜底页在 HashRouter 之外，用不了 useNavigate；重置后让 URL 也回到首页，
      // 否则侧栏高亮（activeNav）会和实际页面不一致，也可能回到出错的那一页。
      window.location.hash = NAV_PATH.assistant;
    } catch (resetError) {
      // 重置本身失败（例如持久化不可用）也照常留在兜底页，不要让恢复动作再抛一次。
      console.error('[anneng-demo] 重置演示数据失败。', resetError);
    }
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="axn-error-fallback" role="alert">
        <Result
          status="error"
          title="页面出错了"
          subTitle="这一步遇到未预期的错误，页面已停下来（演示环境，全部为模拟数据）。可以先「重试」；若反复失败，用「重置演示数据」回到初始状态。"
          extra={
            <Space>
              <Button type="primary" onClick={this.handleRetry}>
                重试
              </Button>
              <Button onClick={this.handleReset}>重置演示数据</Button>
            </Space>
          }
        />
        <details className="axn-error-details">
          <summary>技术细节</summary>
          <Typography.Paragraph>
            <pre>{error.stack ?? `${error.name}: ${error.message}`}</pre>
          </Typography.Paragraph>
        </details>
      </div>
    );
  }
}
