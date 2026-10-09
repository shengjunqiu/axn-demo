import { useState } from 'react';
import { Alert, Button, Checkbox, Space, Table, Tag } from 'antd';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import DeliveryRouteMap from './DeliveryRouteMap';

export default function RouteComparison({
  profile,
  onSelect,
  selectedRoute,
}: {
  profile?: DisasterProfile;
  onSelect: (route: string) => void;
  /** 外部已选路线（与投送表单联动，驱动示意地图） */
  selectedRoute?: string;
}) {
  const [blocked, setBlocked] = useState(true);
  const [control, setControl] = useState(false);
  const [selected, setSelected] = useState('');
  const activeRoute = selectedRoute || selected || '东侧绕行（示例）';
  const rows = [
    {
      id: 'main',
      name: `${profile?.location ?? '事发地'} · 主通道（模拟）`,
      distance: 28,
      eta: 55,
      available: !blocked && !control,
      reason: blocked ? '灾害阻断' : control ? '交通管制未解除' : '通行条件待岗位核对',
    },
    {
      id: 'backup',
      name: `${profile?.category ?? '抢险'}装备备用通道（模拟）`,
      distance: 42,
      eta: 80,
      available: true,
      reason: '装备限高、承载和天气待核',
    },
  ];
  const candidates = rows.filter((r) => r.available).sort((a, b) => a.eta - b.eta);
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        title="投送路径优化"
        type="info"
        description="比较主备路线，排除模拟阻断和管制条件，再按示例ETA推荐。里程和时效为预设演示值，未连接地图导航或实时交通。"
      />
      <DeliveryRouteMap
        profile={profile}
        route={activeRoute}
        road={blocked ? '主路阻断（示例）' : control ? '交通管制（示例）' : '通行条件待核（示例）'}
        progress={0}
      />
      <Space wrap>
        <Checkbox
          checked={blocked}
          onChange={(e) => {
            setBlocked(e.target.checked);
            setSelected('');
            onSelect('');
          }}
        >
          主通道灾害阻断
        </Checkbox>
        <Checkbox
          checked={control}
          onChange={(e) => {
            setControl(e.target.checked);
            setSelected('');
            onSelect('');
          }}
        >
          主通道交通管制
        </Checkbox>
      </Space>
      <Table
        pagination={false}
        size="small"
        rowKey="id"
        scroll={{ x: 600 }}
        dataSource={rows}
        columns={[
          { title: '路线', dataIndex: 'name' },
          { title: '示例里程', render: (_, r) => `${r.distance} km` },
          { title: '示例ETA', render: (_, r) => `${r.eta} min` },
          { title: '约束', dataIndex: 'reason' },
          {
            title: '比较结果',
            render: (_, r) => (
              <Tag color={r.available ? 'blue' : 'red'}>{r.available ? '待核候选' : '排除'}</Tag>
            ),
          },
        ]}
      />
      <Button
        disabled={!candidates.length}
        onClick={() => {
          const next = '东侧绕行（示例）';
          setSelected(next);
          onSelect(next);
        }}
      >
        采用模拟推荐路线
      </Button>
      {(selected || selectedRoute) && (
        <Tag color="blue">已选：{selected || selectedRoute} · 待通行核实</Tag>
      )}
    </Space>
  );
}
