import PropTypes from 'prop-types';
import { useState } from 'react';

import { TableRow, TableCell, Collapse, Box, IconButton } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import { timestamp2string, renderQuota } from 'utils/common';
import Label from 'ui-component/Label';
import LogType from '../type/LogType';

function renderType(type) {
  const typeOption = LogType[type];
  if (typeOption) {
    return (
      <Label variant="filled" color={typeOption.color}>
        {' '}
        {typeOption.text}{' '}
      </Label>
    );
  } else {
    return (
      <Label variant="filled" color="error">
        {' '}
        未知{' '}
      </Label>
    );
  }
}

function renderElapsedTime(elapsedTime) {
  if (!elapsedTime) return '';
  return (elapsedTime / 1000).toFixed(1) + ' s';
}

// 解析并渲染结构化计费明细（billing_detail JSON）；解析失败/为空则回退到 content 字符串
function renderBillingDetail(item) {
  let bd = null;
  try {
    if (item.billing_detail) bd = JSON.parse(item.billing_detail);
  } catch (e) { bd = null; }
  if (!bd || typeof bd !== 'object') {
    return (
      <div>
        <b>计费明细：</b>
        {item.content || '—'}
      </div>
    );
  }
  const r2 = (v) => (typeof v === 'number' ? v.toFixed(2) : v ?? '—');
  return (
    <div>
      <div>
        <b>计费公式：</b>(正常输入 {bd.normal_prompt} + 缓存命中 {bd.billing_cache_hit}×{r2(bd.cache_hit_ratio)} + 缓存写入 {bd.billing_cache_write}×{r2(bd.cache_write_ratio)} + 输出 {bd.completion_tokens}×{r2(bd.completion_ratio)}) × 模型倍率 {r2(bd.model_ratio)} × 分组倍率 {r2(bd.group_ratio)} = {bd.quota}
      </div>
      <div>
        <b>分量：</b>原始输入 {bd.prompt_tokens} / 正常输入 {bd.normal_prompt}；缓存命中 原始 {bd.cache_hit_tokens} / 计费 {bd.billing_cache_hit}；缓存写入 原始 {bd.cache_write_tokens} / 计费 {bd.billing_cache_write}；输出 {bd.completion_tokens}
      </div>
      <div>
        <b>比率：</b>模型 {r2(bd.model_ratio)} × 分组 {r2(bd.group_ratio)} × 输出 {r2(bd.completion_ratio)}；缓存命中 {r2(bd.cache_hit_ratio)}、缓存写入 {r2(bd.cache_write_ratio)}；渠道类型 {bd.channel_type}
      </div>
    </div>
  );
}

export default function LogTableRow({ item, userIsAdmin }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow tabIndex={item.id}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          {timestamp2string(item.created_at)}
        </TableCell>

        {userIsAdmin && <TableCell>{item.channel || ''}</TableCell>}
        {userIsAdmin && (
          <TableCell>
            <Label color="default" variant="outlined">
              {item.username}
            </Label>
          </TableCell>
        )}
        <TableCell>
          {item.token_name && (
            <Label color="default" variant="soft">
              {item.token_name}
            </Label>
          )}
        </TableCell>
        <TableCell>{renderType(item.type)}</TableCell>
        <TableCell>
          {item.model_name && (
            <Label color="primary" variant="outlined">
              {item.model_name}
            </Label>
          )}
        </TableCell>
        <TableCell>{renderElapsedTime(item.elapsed_time)}</TableCell>
        <TableCell>{item.first_token_time ? (item.first_token_time / 1000).toFixed(1) + ' s' : '—'}</TableCell>
        <TableCell>{item.group || ''}</TableCell>
        <TableCell>
          {item.prompt_tokens
            ? item.cache_hit_tokens
              ? `${item.prompt_tokens}（缓存命中 ${item.cache_hit_tokens}）`
              : item.prompt_tokens
            : ''}
        </TableCell>
        <TableCell>{item.completion_tokens || ''}</TableCell>
        <TableCell>{item.quota ? renderQuota(item.quota, 6) : ''}</TableCell>
        {userIsAdmin && <TableCell>{item.ip || ''}</TableCell>}
        <TableCell>{item.content}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={userIsAdmin ? 14 : 11}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1, lineHeight: 1.9 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <span><b>Request ID：</b>{item.request_id || '—'}</span>
                <span><b>缓存命中：</b>{item.cache_hit_tokens || 0}</span>
                <span><b>缓存写入：</b>{item.cache_write_tokens || 0}</span>
                <span><b>首字延迟：</b>{item.first_token_time ? (item.first_token_time / 1000).toFixed(2) + ' s' : '—'}</span>
                <span><b>总耗时：</b>{item.elapsed_time ? (item.elapsed_time / 1000).toFixed(2) + ' s' : '—'}</span>
              </div>
              {renderBillingDetail(item)}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

LogTableRow.propTypes = {
  item: PropTypes.object,
  userIsAdmin: PropTypes.bool
};
