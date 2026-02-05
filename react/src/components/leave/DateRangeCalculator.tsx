/**
 * Date Range Calculator Component
 * Calculates and displays working days between dates excluding weekends and holidays
 */

import { useState, useEffect } from 'react';
import { DatePicker, Spin, Alert, Row, Col, Statistic } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useHolidayREST, WorkingDaysResult } from '../../hooks/useHolidayREST';

interface DateRangeCalculatorProps {
  value?: { startDate: string; endDate: string };
  onChange?: (dates: { startDate: string; endDate: string; workingDays: number }) => void;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
}

export const DateRangeCalculator: React.FC<DateRangeCalculatorProps> = ({
  value,
  onChange,
  disabled = false,
  size = 'middle'
}) => {
  const [calculating, setCalculating] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(value?.startDate ? dayjs(value.startDate) : null);
  const [endDate, setEndDate] = useState<Dayjs | null>(value?.endDate ? dayjs(value.endDate) : null);
  const [calculation, setCalculation] = useState<WorkingDaysResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { calculateWorkingDays } = useHolidayREST();

  useEffect(() => {
    if (startDate && endDate) {
      performCalculation();
    } else {
      setCalculation(null);
    }
  }, [startDate, endDate]);

  const performCalculation = async () => {
    if (!startDate || !endDate) return;

    setCalculating(true);
    setError(null);

    try {
      const result = await calculateWorkingDays({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (result) {
        setCalculation(result);
        onChange?.({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          workingDays: result.workingDays
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to calculate working days');
      setCalculation(null);
    } finally {
      setCalculating(false);
    }
  };

  const disabledDate = (current: Dayjs) => {
    return current && current < dayjs().startOf('day');
  };

  const disabledEndDate = (current: Dayjs) => {
    return disabledDate(current) || (startDate && current < startDate);
  };

  return (
    <div className="date-range-calculator">
      <Row gutter={16}>
        <Col span={12}>
          <DatePicker
            value={startDate}
            onChange={(date) => {
              setStartDate(date);
              if (date && endDate && date.isAfter(endDate)) {
                setEndDate(null);
              }
            }}
            disabledDate={disabledDate}
            disabled={disabled}
            style={{ width: '100%' }}
            placeholder="Start Date"
            size={size}
          />
        </Col>
        <Col span={12}>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            disabledDate={disabledEndDate}
            disabled={disabled || !startDate}
            style={{ width: '100%' }}
            placeholder="End Date"
            size={size}
          />
        </Col>
      </Row>

      {calculating && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Spin size="small" /> Calculating working days...
        </div>
      )}

      {error && (
        <Alert
          message="Calculation Error"
          description={error}
          type="error"
          showIcon
          style={{ marginTop: 12 }}
        />
      )}

      {calculation && (
        <div className="calculation-result" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="Total Days"
                value={calculation.totalDays}
                valueStyle={{ fontSize: size === 'small' ? 16 : 20 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Working Days"
                value={calculation.workingDays}
                suffix="days"
                valueStyle={{ fontSize: size === 'small' ? 16 : 20, color: '#52c41a' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Holidays/Weekends"
                value={calculation.holidayCount + calculation.weekendDays}
                valueStyle={{ fontSize: size === 'small' ? 16 : 20, color: '#faad14' }}
              />
            </Col>
          </Row>

          {calculation.holidayCount > 0 && (
            <Alert
              message={`${calculation.holidayCount} holiday(s) in this period`}
              description={calculation.holidays.map(h =>
                `${dayjs(h.date).format('MMM DD')}: ${h.name}`
              ).join(', ')}
              type="info"
              showIcon
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangeCalculator;
