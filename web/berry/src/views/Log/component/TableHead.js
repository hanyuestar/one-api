import PropTypes from 'prop-types';
import { TableCell, TableHead, TableRow } from '@mui/material';

const headCellSx = { whiteSpace: 'nowrap', fontWeight: 600 };

const LogTableHead = ({ userIsAdmin }) => {
  return (
    <TableHead>
      <TableRow>
        <TableCell sx={headCellSx}>时间</TableCell>
        {userIsAdmin && <TableCell sx={headCellSx}>渠道</TableCell>}
        {userIsAdmin && <TableCell sx={headCellSx}>用户</TableCell>}
        <TableCell sx={headCellSx}>令牌</TableCell>
        <TableCell sx={headCellSx}>类型</TableCell>
        <TableCell sx={headCellSx}>模型</TableCell>
        <TableCell sx={headCellSx}>用时</TableCell>
        <TableCell sx={headCellSx}>首字</TableCell>
        <TableCell sx={headCellSx}>分组</TableCell>
        <TableCell sx={headCellSx}>输入</TableCell>
        <TableCell sx={headCellSx}>输出</TableCell>
        <TableCell sx={headCellSx}>额度</TableCell>
        {userIsAdmin && <TableCell sx={headCellSx}>IP</TableCell>}
        <TableCell sx={headCellSx}>详情</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default LogTableHead;

LogTableHead.propTypes = {
  userIsAdmin: PropTypes.bool
};
