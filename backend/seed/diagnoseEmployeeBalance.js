/**
 * Diagnostic script to check employee leave balance data
 * Run: node backend/seed/diagnoseEmployeeBalance.js
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:AdMin-2025@cluster0.iooxltd.mongodb.net/';

async function diagnoseEmployeeBalance() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    // 1. Check AmasQIS database for employees with clerkUserId
    console.log('=== CHECKING AmasQIS DATABASE ===');
    const amasQIS = client.db('AmasQIS');
    const employees = amasQIS.collection('employees');

    const employee = await employees.findOne({
      clerkUserId: { $exists: true, $ne: null }
    });

    if (!employee) {
      console.log('❌ No employee found with clerkUserId in AmasQIS');
      console.log('\nSearching for any employee...');
      const allEmployees = await employees.find({}).limit(3).toArray();
      console.log('Found', allEmployees.length, 'employees total');
      allEmployees.forEach(emp => {
        console.log(` - ${emp.employeeId}: ${emp.firstName} ${emp.lastName}, clerkUserId: ${emp.clerkUserId || 'NONE'}, companyId: ${emp.companyId || 'NONE'}`);
      });
      return;
    }

    console.log('✅ Found employee in AmasQIS:');
    console.log(`   employeeId: ${employee.employeeId}`);
    console.log(`   clerkUserId: ${employee.clerkUserId}`);
    console.log(`   firstName: ${employee.firstName}`);
    console.log(`   lastName: ${employee.lastName}`);
    console.log(`   companyId: ${employee.companyId}`);
    console.log(`   hasLeaveBalance: ${!!employee.leaveBalance}`);
    if (employee.leaveBalance?.balances) {
      console.log(`   balances count: ${employee.leaveBalance.balances.length}`);
      employee.leaveBalance.balances.forEach(b => {
        console.log(`     - ${b.type}: total=${b.total}, used=${b.used}, balance=${b.balance}`);
      });
    } else {
      console.log('   ⚠️  NO BALANCES ARRAY in leaveBalance');
    }

    // 2. Check company database
    const companyId = employee.companyId;
    if (!companyId) {
      console.log('\n❌ Employee has no companyId - cannot check company database');
      return;
    }

    console.log(`\n=== CHECKING COMPANY DATABASE: ${companyId} ===`);
    const companyDb = client.db(companyId);

    // Check employee in company DB
    const companyEmployee = await companyDb.collection('employees').findOne({
      employeeId: employee.employeeId
    });

    if (!companyEmployee) {
      console.log('❌ Employee NOT found in company database');
    } else {
      console.log('✅ Found employee in company DB:');
      console.log(`   hasLeaveBalance: ${!!companyEmployee.leaveBalance}`);
      if (companyEmployee.leaveBalance?.balances) {
        console.log(`   balances count: ${companyEmployee.leaveBalance.balances.length}`);
        companyEmployee.leaveBalance.balances.forEach(b => {
          console.log(`     - ${b.type}: total=${b.total}, used=${b.used}, balance=${b.balance}`);
        });
      } else {
        console.log('   ⚠️  NO BALANCES ARRAY in leaveBalance');
      }
    }

    // 3. Check leaveTypes in company DB
    console.log('\n=== CHECKING LEAVE TYPES IN COMPANY DB ===');
    const leaveTypes = await companyDb.collection('leaveTypes').find({
      isActive: true,
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`Found ${leaveTypes.length} active leave types:`);
    if (leaveTypes.length === 0) {
      console.log('❌ NO ACTIVE LEAVE TYPES FOUND in company database!');
      console.log('This is why balance shows 0 - no leave types to fetch');
    } else {
      leaveTypes.forEach(lt => {
        console.log(` - ${lt.code} (${lt.name}): quota=${lt.annualQuota}, paid=${lt.isPaid}`);
      });
    }

    // 4. Check for any issues with the balances array structure
    console.log('\n=== BALANCE STRUCTURE ANALYSIS ===');
    const empToCheck = companyEmployee || employee;
    if (empToCheck?.leaveBalance?.balances) {
      const balances = empToCheck.leaveBalance.balances;
      console.log(`Balance array has ${balances.length} entries`);

      // Check if types match leaveType codes
      const typeCodes = leaveTypes.map(lt => lt.code.toLowerCase());
      console.log('Expected type codes:', typeCodes);

      const balanceTypes = balances.map(b => b.type);
      console.log('Actual balance types:', balanceTypes);

      const missing = typeCodes.filter(t => !balanceTypes.includes(t));
      if (missing.length > 0) {
        console.log('⚠️  Missing types in balances:', missing);
      }

      const extra = balanceTypes.filter(t => !typeCodes.includes(t));
      if (extra.length > 0) {
        console.log('⚠️  Extra types in balances (not in leaveTypes):', extra);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\n=== DIAGNOSIS COMPLETE ===');
  }
}

diagnoseEmployeeBalance();
