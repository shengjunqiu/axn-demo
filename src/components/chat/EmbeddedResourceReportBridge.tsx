import { startEmbeddedSuppliesAudit } from '@/services/embeddedSuppliesAudit';
import { V2_AI_MODES } from '@/pages/v2/aiNodes';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RESOURCE_REPORT_READY, RESOURCE_REPORT_REQUEST } from '@/pages/v2/surroundingsData';
import { generateEmbeddedResourceReport, generateEmbeddedAssemblyReport, generateEmbeddedPlanReport, generateEmbeddedAdditionalReport } from '@/services/embeddedResourceReport';

export default function EmbeddedResourceReportBridge() {
  const location = useLocation();
  useEffect(() => {
    const embedded = new URLSearchParams(location.search).get('embedded');
    if (!V2_AI_MODES.includes(embedded ?? '') || window.parent === window) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== RESOURCE_REPORT_REQUEST || typeof event.data.requestId !== 'string' || event.data.requestId.length > 100) return;
      if (embedded === 'v2-supplies' && event.data.kind === 'supplies') startEmbeddedSuppliesAudit(event.data.requestId);
      else if (['dynamics', 'transport', 'summary'].includes(event.data.kind) && embedded === `v2-${event.data.kind}`) void generateEmbeddedAdditionalReport(event.data.kind, event.data.requestId);
      else if (embedded === 'v2-plan' && event.data.kind === 'plan') void generateEmbeddedPlanReport(event.data.requestId);
      else if (embedded === 'v2-assembly' && event.data.kind === 'assembly') void generateEmbeddedAssemblyReport(event.data.requestId);
      else if (embedded === 'v2-surroundings' && (!event.data.kind || event.data.kind === 'surroundings')) void generateEmbeddedResourceReport(event.data.requestId);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: RESOURCE_REPORT_READY }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [location.search]);
  return null;
}
