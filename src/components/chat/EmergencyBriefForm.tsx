import { useEffect, useState } from 'react';
import { App as AntdApp, Button, Form, Input, Upload } from 'antd';
import { ImagePlus, X } from 'lucide-react';

/**
 * 生成应急要情前的表头表单：期号、审阅人、报送单位、承办单位、值班员、值班电话，外加一个附图选择器。
 * 直接渲染在会话流里（气泡卡片、单列表单），不再是弹窗（用户 m00167）；
 * 填完即出件，也不再走气泡里逐条「收集文书要素」的模拟动画（用户 m00001）。
 */
export type BriefFormValues = {
  /** 期号：落在红头文的发文字号行（如「应急报〔2026〕022号」） */
  issue: string;
  /** 审阅人：落在时间行的签发/审阅处 */
  reviewer: string;
  /** 报送单位：落在版记「报送：」行 */
  reportingUnit: string;
  /** 承办单位：落在版记「承办：」行 */
  organizer: string;
  /** 值班员：落在版记「承办：」行的编辑位 */
  dutyOfficer: string;
  /** 值班电话：落在版记「承办：」行的电话位 */
  dutyPhone: string;
};

/** 用户上传的附图：直接进文书正文尾部的「附：现场处置图片」区（用户 m00215）。 */
export type BriefFigure = { src: string; caption: string };

/** 预填一版可直接提交的演示值：期号按当前年份排到 022 号（样稿是 021 号）。 */
export function briefFormDefaults(): BriefFormValues {
  return {
    issue: `应急报〔${new Date().getFullYear()}〕022号`,
    reviewer: '王建军',
    reportingUnit: '集团应急指挥中心',
    organizer: '应急指挥中心值班室',
    dutyOfficer: '李海涛',
    dutyPhone: '010-66328801',
  };
}

const FIELDS: { name: keyof BriefFormValues; label: string; placeholder: string; testId: string }[] = [
  { name: 'issue', label: '期号', placeholder: '应急报〔2026〕022号', testId: 'brief-form-issue' },
  { name: 'reviewer', label: '审阅人', placeholder: '王建军', testId: 'brief-form-reviewer' },
  { name: 'reportingUnit', label: '报送单位', placeholder: '集团应急指挥中心', testId: 'brief-form-reporting-unit' },
  { name: 'organizer', label: '承办单位', placeholder: '应急指挥中心值班室', testId: 'brief-form-organizer' },
  { name: 'dutyOfficer', label: '值班员', placeholder: '李海涛', testId: 'brief-form-duty-officer' },
  { name: 'dutyPhone', label: '值班电话', placeholder: '010-66328801', testId: 'brief-form-duty-phone' },
];

/** 读成 data URL 再进文书：演示环境不落盘，但要保证切会话/刷新后附图还在。 */
function readImage(file: File): Promise<BriefFigure> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ src: String(reader.result), caption: file.name.replace(/\.[^.]+$/, '') });
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

export default function EmergencyBriefForm({ onSubmit, onCancel, disabled }: {
  onSubmit: (values: BriefFormValues, figures: BriefFigure[]) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [form] = Form.useForm<BriefFormValues>();
  const [figures, setFigures] = useState<BriefFigure[]>([]);
  const { message } = AntdApp.useApp();
  useEffect(() => { form.setFieldsValue(briefFormDefaults()); }, [form]);
  const addImage = async (file: File) => {
    try {
      const figure = await readImage(file);
      setFigures(list => [...list, figure]);
    } catch {
      message?.error(`读取 ${file.name} 失败`);
    }
  };
  return (
    <div className="axn-brief-form" data-testid="brief-form">
      <div className="axn-brief-form-head">
        <strong>生成应急要情</strong>
        <span className="axn-brief-form-hint">填写表头信息，确认后直接出件</span>
      </div>
      <Form form={form} layout="vertical" requiredMark={false} disabled={disabled}>
        {FIELDS.map(field => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={[{ required: true, whitespace: true, message: `请填写${field.label}` }]}
          >
            <Input placeholder={field.placeholder} data-testid={field.testId} />
          </Form.Item>
        ))}
      </Form>
      <div className="axn-brief-form-images">
        <div className="axn-brief-form-images-label">
          附图<em>可选，会附在正文之后</em>
        </div>
        <div className="axn-brief-form-thumbs">
          {figures.map((figure, index) => <div key={figure.src} className="axn-brief-form-thumb">
            <img src={figure.src} alt={figure.caption} />
            <button type="button" className="axn-brief-form-thumb-remove" aria-label={`移除 ${figure.caption}`}
              onClick={() => setFigures(list => list.filter((_, i) => i !== index))}>
              <X size={12} />
            </button>
          </div>)}
          {/* 外面这层 span 收 data-testid：antd Upload 不把 data-* 透到 DOM（e2e 要按它找 file input） */}
          <span className="axn-brief-form-add" data-testid="brief-form-images">
            <Upload
              multiple
              accept="image/*"
              showUploadList={false}
              disabled={disabled}
              beforeUpload={file => { void addImage(file); return false; }}
            >
              <button type="button" className="axn-brief-form-add-tile" data-testid="brief-form-add-image" disabled={disabled}>
                <ImagePlus size={16} aria-hidden />
                <span>{figures.length ? '继续添加' : '上传图片'}</span>
              </button>
            </Upload>
          </span>
        </div>
      </div>
      <div className="axn-brief-form-actions">
        <Button onClick={onCancel} data-testid="brief-form-cancel">取消</Button>
        <Button type="primary" disabled={disabled} data-testid="brief-form-submit"
          onClick={() => { void form.validateFields().then(values => onSubmit(values, figures)); }}>
          确认并生成
        </Button>
      </div>
    </div>
  );
}
